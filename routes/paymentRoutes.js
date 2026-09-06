import express from "express";
import { createOrder, getPaymentStatus, initiateRefund, verifyPayment } from "../controllers/paymentController.js";
import { handleWebhook } from "../controllers/webhookController.js";
import { readLimiter, strictLimiter } from "../middleware/rateLimiter.js";
import { verifyApiKey } from "../middleware/authMiddleware.js";
import { idempotencyCheck } from "../middleware/idempotency.js";
import { validate } from "../middleware/validate.js";
import { createOrderSchema, paymentStatusQuerySchema, refundSchema, verifyPaymentSchema } from "../validators/paymentValidators.js";

export const createPaymentRouter = () => {
	const router = express.Router();

	router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
	router.use(express.json());
	router.post('/create-order', verifyApiKey, strictLimiter, idempotencyCheck, validate(createOrderSchema), createOrder);
	router.post('/verify-payment', verifyApiKey, strictLimiter, validate(verifyPaymentSchema), verifyPayment);
	router.post('/refund', verifyApiKey, strictLimiter, idempotencyCheck, validate(refundSchema), initiateRefund);
	router.get('/status', verifyApiKey, readLimiter, validate(paymentStatusQuerySchema, 'query'), getPaymentStatus);

	return router;
};

const paymentRouter = createPaymentRouter();

export default paymentRouter;