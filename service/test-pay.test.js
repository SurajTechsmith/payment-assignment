import { describe, it, expect, vi } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

require('dotenv').config()
const q = require('../db/queries')
const pool = require('../db/pool')
const paymentService = require('./paymentService')

describe('1. Idempotency Logic', () => {
  it('should save and retrieve an idempotency record', async () => {
    const key = `test-key-${uuidv4()}`
    const mockResponse = { id: '123', status: 'accepted' }

    await q.saveIdempotencyRecord(key, mockResponse)
    const record = await q.getIdempotencyRecord(key)

    expect(record).toBeDefined()
    
    // FIX: If pg returns an object, don't parse it. If it's a string, parse it.
    const parsedResponse = typeof record.response === 'string' 
      ? JSON.parse(record.response) 
      : record.response;

    expect(parsedResponse).toEqual(mockResponse)
  })
})

describe('3. Retry Logic & Backoff', () => {
  it('should calculate next_retry_at with exponential backoff', async () => {
    const client = await pool.connect()
    try {
      // FIX: Added idempotencyKey
      const payment = await q.createPayment({ 
        amount: 50, 
        idempotencyKey: uuidv4() 
      })
      
      const retryCount = 1
      const baseDelay = 1000
      const now = Date.now()
      const expectedMin = new Date(now + 1900) 
      
      const updated = await q.updatePaymentStatus(client, payment.id, 'failed', {
        retry_count: retryCount + 1,
        next_retry_at: new Date(now + (baseDelay * Math.pow(2, retryCount))),
        failure_reason: 'Timeout'
      })

      expect(updated.retry_count).toBe(2)
      expect(new Date(updated.next_retry_at).getTime()).toBeGreaterThanOrEqual(expectedMin.getTime())
    } finally {
      client.release()
    }
  })

  it('should find payments due for retry', async () => {
    const pastDate = new Date(Date.now() - 3600000)
    const client = await pool.connect()
    
    // FIX: Added idempotencyKey
    const p = await q.createPayment({ 
      amount: 10, 
      idempotencyKey: uuidv4() 
    })
    
    await q.updatePaymentStatus(client, p.id, 'failed', {
      retry_count: 1,
      next_retry_at: pastDate
    })
    client.release()

    const due = await q.getPaymentsDueForRetry()
    expect(due.length).toBeGreaterThan(0)
  })
})

describe('4. State Machine & Concurrency Logic', () => {
  it('should maintain row-level locks during updates', async () => {
    // FIX: Added idempotencyKey
    const p = await q.createPayment({ 
      amount: 200, 
      idempotencyKey: uuidv4() 
    })
    
    const client = await pool.connect()
    await client.query('BEGIN')
    const lockedPayment = await q.getPaymentByIdForUpdate(client, p.id)
    expect(lockedPayment.id).toBe(p.id)
    await client.query('COMMIT')
    client.release()
  })

  it('should log every status transition in payment_events', async () => {
    const client = await pool.connect()
    // FIX: Added idempotencyKey
    const p = await q.createPayment({ 
      amount: 5, 
      idempotencyKey: uuidv4() 
    })
    
    await q.logEvent(client, {
      paymentId: p.id,
      fromStatus: 'pending',
      toStatus: 'processing',
      reason: 'Testing log'
    })

    const res = await pool.query('SELECT * FROM payment_events WHERE payment_id = $1', [p.id])
    expect(res.rows.length).toBe(1)
    client.release()
  })
})