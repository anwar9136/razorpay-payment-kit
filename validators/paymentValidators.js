import { z } from 'zod';

export const createOrderSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be greater than 0')
    .max(500000, 'Amount exceeds maximum allowed (₹5,00,000)'),
  currency: z.string().length(3, 'Currency must be a 3-letter code').default('INR'),
  receipt: z.string().min(1, 'Receipt is required').max(100),
  entityType: z.string().min(1, 'entityType is required'),
  entityId: z.string().min(1, 'entityId is required'),
  notes: z.record(z.string(), z.any()).optional().default({}),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'razorpay_order_id is required'),
  razorpay_payment_id: z.string().min(1, 'razorpay_payment_id is required'),
  razorpay_signature: z.string().min(1, 'razorpay_signature is required'),
});

export const refundSchema = z.object({
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  amount: z.number().positive('Refund amount must be greater than 0').optional(),
  reason: z.string().max(200).optional(),
});

export const paymentStatusQuerySchema = z.object({
  entityType: z.string().min(1, 'entityType is required'),
  entityId: z.string().min(1, 'entityId is required'),
});