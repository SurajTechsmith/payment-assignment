const paymentService = require('./service/paymentService');
const q = require('./db/queries');

async function runRetryCycle() {
  try {
    const duePayments = await q.getPaymentsDueForRetry();
    if (duePayments.length > 0) {
      console.log(`[Worker] Found ${duePayments.length} payments due for retry.`);
      for (const payment of duePayments) {
      
        await paymentService.processPayment(payment.id);
      }
    }
  } catch (err) {
    console.error(`[Worker Error] ${err.message}`);
  }
}

setInterval(runRetryCycle, 10000);