import crypto from "crypto";
import Payment from "../models/Payment.js";
import { getConfig } from "../config/paymentServiceConfig.js";

export const handleWebhook = async (req, res) => {
  const {webhookSecret} = getConfig()
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];

    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');

    if (generatedSignature !== webhookSignature) {
      console.warn('Webhook signature mismatch — possible spoofed request');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString('utf8'));

    if (event.event === 'payment.captured') {
      await handlePaymentCaptured(event);
    } else if (event.event === 'payment.failed') {
      await handlePaymentFailed(event);
    } else if (event.event === 'refund.processed') {
      await handleRefundProcessed(event);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handling error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

// --- Individual event handlers below, each focused on ONE job ---

const handlePaymentCaptured = async (event) => {
  const paymentEntity = event.payload.payment.entity;
  const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });

  if (!payment) {
    console.warn('payment.captured for unknown order:', paymentEntity.order_id);
    return;
  }

  if (payment.status === 'paid') {
    console.log('payment.captured — already processed, skipping');
    return;
  }

  payment.status = 'paid';
  payment.razorpayPaymentId = paymentEntity.id;
  await payment.save();

  console.log(`Payment ${paymentEntity.id} confirmed via webhook`);
};

const handlePaymentFailed = async (event) => {
  const paymentEntity = event.payload.payment.entity;
  const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });

  if (!payment) {
    console.warn('payment.failed for unknown order:', paymentEntity.order_id);
    return;
  }

  // Don't overwrite a payment that's already succeeded (edge case, but safe to guard)
  if (payment.status === 'paid') {
    return;
  }

  payment.status = 'failed';
  payment.failureReason = paymentEntity.error_description || 'Unknown failure';
  await payment.save();

  console.log(`Payment failed for order ${paymentEntity.order_id}: ${payment.failureReason}`);
};

const handleRefundProcessed = async (event) => {
  const refundEntity = event.payload.refund.entity;
  const payment = await Payment.findOne({ 'refunds.razorpayRefundId': refundEntity.id });

  if (!payment) {
    console.warn('refund.processed for unknown refund:', refundEntity.id);
    return;
  }

  const refund = payment.refunds.find((r) => r.razorpayRefundId === refundEntity.id);

  if (refund.status === 'processed') {
    console.log('refund.processed — already processed, skipping');
    return;
  }

  refund.status = 'processed';
  await payment.save();

  console.log(`Refund ${refundEntity.id} confirmed as processed`);
};