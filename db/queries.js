const pool = require('./pool');


async function createPayment({ idempotencyKey, amount, currency = 'USD' }) {
  const result = await pool.query(
    `INSERT INTO payments (idempotency_key, amount, currency, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [idempotencyKey, amount, currency]
  );
  return result.rows[0];
}

async function getPaymentById(id) {
  const result = await pool.query(
    `SELECT * FROM payments WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getPaymentByIdForUpdate(client, id) {
  const result = await client.query(
    `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return result.rows[0] || null;
}

async function updatePaymentStatus(client, id, status, extra = {}) {
  const result = await client.query(
    `UPDATE payments
     SET status = $1,
         gateway_ref    = COALESCE($3, gateway_ref),
         failure_reason = COALESCE($4, failure_reason),
         retry_count    = COALESCE($5, retry_count),
         next_retry_at  = COALESCE($6, next_retry_at),
         updated_at     = NOW()
     WHERE id = $2
     RETURNING *`,
    [
      status,
      id,
      extra.gateway_ref    ?? null,
      extra.failure_reason ?? null,
      extra.retry_count    ?? null,
      extra.next_retry_at  ?? null,
    ]
  );
  return result.rows[0];
}


async function logEvent(client, { paymentId, fromStatus, toStatus, reason }) {
  await client.query(
    `INSERT INTO payment_events (payment_id, from_status, to_status, reason)
     VALUES ($1, $2, $3, $4)`,
    [paymentId, fromStatus ?? null, toStatus, reason ?? null]
  );
}


async function getIdempotencyRecord(key) {
  const result = await pool.query(
    `SELECT * FROM idempotency_records WHERE key = $1`,
    [key]
  );
  return result.rows[0] || null;
}

async function saveIdempotencyRecord(key, response) {
  await pool.query(
    `INSERT INTO idempotency_records (key, response)
     VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING`,  // safe to call twice
    [key, JSON.stringify(response)]
  );
}

async function getPaymentsDueForRetry() {
  const result = await pool.query(
    `SELECT * FROM payments
     WHERE status = 'failed'
       AND retry_count < max_retries
       AND next_retry_at <= NOW()
     ORDER BY next_retry_at ASC
     LIMIT 10`
  );
  return result.rows;
}

module.exports = {
  createPayment,
  getPaymentById,
  getPaymentByIdForUpdate,
  updatePaymentStatus,
  logEvent,
  getIdempotencyRecord,
  saveIdempotencyRecord,
  getPaymentsDueForRetry,
};