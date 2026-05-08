const express = require('express');
const router = express.Router();
const q = require('../db/queries');
const pool = require('../db/pool');

router.post('/gateway', async (req, res) => {
  const { payment_id, status, gateway_ref } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const payment = await q.getPaymentByIdForUpdate(client, payment_id);
    
    if (payment && payment.status !== 'success') {
      await q.updatePaymentStatus(client, payment_id, status, { gateway_ref });
      await q.logEvent(client, { paymentId: payment_id, toStatus: status, reason: 'Webhook received' });
    }
    
    await client.query('COMMIT');
    res.sendStatus(200);
  } catch (err) {
    await client.query('ROLLBACK');
    res.sendStatus(500);
  } finally {
    client.release();
  }
});

module.exports = router;