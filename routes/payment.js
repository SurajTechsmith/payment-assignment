const express = require('express')
const router = express.Router()
const paymentService = require('../service/paymentService')
const idempotency = require('../middleware/idempotency')
const q = require('../db/queries')

router.post('/', idempotency, async (req, res, next) => {
  try {
    const { amount, currency } = req.body

    const payment = await paymentService.createPayment({
      idempotencyKey: req.idempotencyKey || req.body.idempotency_key,
      amount,
      currency,
    })

   
    paymentService.processPayment(payment.id).catch(err => {
      console.error(`[Route] Background processing failed: ${err.message}`)
    })

   
    const response = { id: payment.id, status: payment.status, amount, currency }
    if (req.idempotencyKey) {
      await q.saveIdempotencyRecord(req.idempotencyKey, response)
    }

    res.status(202).json(response)  
  } catch (err) {
    next(err)
  }
})


router.get('/:id', async (req, res, next) => {
  try {
    const payment = await paymentService.getPayment(req.params.id)
    res.json(payment)
  } catch (err) {
    next(err)
  }
})

module.exports = router