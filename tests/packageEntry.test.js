import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentRouter,
  initPaymentService,
  paymentRouter,
  Payment,
} from '../index.js';

test('package entry point exposes the intended public API', () => {
  assert.equal(typeof createPaymentRouter, 'function');
  assert.equal(typeof paymentRouter, 'function');
  assert.equal(Payment.modelName, 'Payment');
  assert.equal(typeof initPaymentService, 'function');
});

test('router factory creates an Express router without starting a server', () => {
  const router = createPaymentRouter();

  assert.equal(typeof router, 'function');
  assert.ok(Array.isArray(router.stack));
  assert.ok(router.stack.some((layer) => layer.route?.path === '/webhook'));
});

test('configuration initialization accepts host-provided values', () => {
  assert.doesNotThrow(() => {
    initPaymentService({
      razorpayKeyId: 'rzp_test_key',
      razorpaySecret: 'razorpay-secret',
      webhookSecret: 'webhook-secret',
      apiKey: 'host-api-key',
    });
  });
});
