import { describe, it, expect, beforeAll } from 'vitest';
const pool = require('./pool');

describe('Database Connection', () => {
  it('should return the current time from the DB', async () => {
    const res = await pool.query('SELECT NOW()');
    expect(res.rows[0]).toBeDefined(); 
  });

});