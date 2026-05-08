

const pool = require('../db/pool');
const queries = require('../db/queries');
const { chargePayment } = require('../fakeGatewayService');


const VALID_TRANSITIONS = {
  pending:    ['processing'],
  processing: ['success', 'failed'],
  failed:     ['processing'],   
  success:    [],              
};

function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}


async function createPayment({ idempotencyKey, amount, currency }) {
 
  if (!idempotencyKey) throw Object.assign(new Error('idempotency_key is required'), { statusCode: 400 });
  if (!amount || amount <= 0) throw Object.assign(new Error('Invalid amount'), { statusCode: 400 });

  const payment = await queries.createPayment({ idempotencyKey, amount, currency });

  console.log(`[Payment] Created: ${payment.id} | amount: ${amount} ${currency}`);
  return payment;
}


async function processPayment(paymentId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const payment = await queries.getPaymentByIdForUpdate(client, paymentId);

    if (!payment) throw new Error(`Payment not found: ${paymentId}`);

    
    if (!canTransition(payment.status, 'processing')) {
      console.log(`[Payment] Skipping ${paymentId} — already ${payment.status}`);
      await client.query('ROLLBACK');
      return payment;
    }

    
    await queries.updatePaymentStatus(client, paymentId, 'processing');
    await queries.logEvent(client, {
      paymentId,
      fromStatus: payment.status,
      toStatus: 'processing',
    });

   
    await client.query('COMMIT');

    console.log(`[Payment] Processing: ${paymentId}`);

    
    let gatewayResult;
    try {
      gatewayResult = await chargePayment({
        amount: payment.amount,
        currency: payment.currency,
      });
    } catch (gatewayErr) {
      
      await markFailed(paymentId, payment, gatewayErr);
      return await queries.getPaymentById(paymentId);
    }

 
    await markSuccess(paymentId, payment, gatewayResult);
    return await queries.getPaymentById(paymentId);

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markSuccess(paymentId, payment, gatewayResult) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await queries.updatePaymentStatus(client, paymentId, 'success', {
      gateway_ref: gatewayResult.gatewayRef,
    });
    await queries.logEvent(client, {
      paymentId,
      fromStatus: 'processing',
      toStatus: 'success',
    });
    await client.query('COMMIT');
    console.log(`[Payment] Success: ${paymentId} | ref: ${gatewayResult.gatewayRef}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


async function markFailed(paymentId, payment, err) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const retryCount = (payment.retry_count || 0) + 1;
    const canRetry = err.isRetryable && retryCount < payment.max_retries;

    const backoffMs = 1000 * Math.pow(2, retryCount) + Math.random() * 500;
    const nextRetryAt = canRetry
      ? new Date(Date.now() + backoffMs).toISOString()
      : null;

    await queries.updatePaymentStatus(client, paymentId, 'failed', {
      failure_reason: err.message,
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
    });
    await queries.logEvent(client, {
      paymentId,
      fromStatus: 'processing',
      toStatus: 'failed',
      reason: err.message,
    });

    await client.query('COMMIT');
    console.log(`[Payment] Failed: ${paymentId} | reason: ${err.message} | retryable: ${canRetry}`);
  } catch (err2) {
    await client.query('ROLLBACK');
    throw err2;
  } finally {
    client.release();
  }
}


async function getPayment(paymentId) {
  const payment = await queries.getPaymentById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  return payment;
}

module.exports = { createPayment, processPayment, getPayment, canTransition };