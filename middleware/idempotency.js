const q = require('../db/queries')

async function idempotencyMiddleware(req, res, next) {
  const key = req.headers['idempotency-key']

  if (!key) return next()

  try {
    const existing = await q.getIdempotencyRecord(key)

    if (existing) {
    
      console.log(`[Idempotency] Cache hit for key: ${key}`)
      return res.status(200).json(existing.response)
    }

    req.idempotencyKey = key
    next()

  } catch (err) {
    next(err)
  }
}

module.exports = idempotencyMiddleware