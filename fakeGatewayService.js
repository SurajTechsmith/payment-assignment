
// src/services/gatewayService.js
const { v4: uuidv4 } = require('uuid');

// Simulates calling an external payment API
async function chargePayment({ amount, currency }) {
  // Simulate network delay (200ms–2000ms)
  const delay = 200 + Math.random() * 1800;
  await sleep(delay);

  // Simulate timeout (5% chance)
  if (Math.random() < 0.05) {
    throw Object.assign(new Error('Gateway timeout'), {
      code: 'GATEWAY_TIMEOUT',
      isRetryable: true,
    });
  }

  // Simulate random failure (20% chance)
  if (Math.random() < 0.20) {
    const retryable = Math.random() < 0.5;
    throw Object.assign(new Error('Gateway error'), {
      code: retryable ? 'GATEWAY_ERROR' : 'CARD_DECLINED',
      isRetryable: retryable,   // card declined = not retryable
    });
  }

  // Success — return a fake gateway transaction reference
  return {
    gatewayRef: `gw_${uuidv4()}`,
    status: 'success',
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { chargePayment };