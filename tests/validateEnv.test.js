import test from 'node:test';
import assert from 'node:assert/strict';
import validateEnv from '../config/validateEnv.js';

const requiredKeys = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'MONGO_URI',
  'PAYMENT_SERVICE_API_KEY',
];

test('validateEnv exits when required env vars are missing', () => {
  const originalEnv = { ...process.env };
  const originalExit = process.exit;

  for (const key of requiredKeys) {
    delete process.env[key];
  }

  let exitCalled = false;
  process.exit = (code) => {
    exitCalled = true;
    throw new Error(`exit:${code}`);
  };

  try {
    assert.throws(() => validateEnv(), /exit:1/);
    assert.equal(exitCalled, true);
  } finally {
    process.exit = originalExit;
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  }
});
