import Payment from "../models/Payment.js";
import { getRazorpayInstance } from "../config/razorpay.js";
import crypto from "crypto";
import { respondWithIdempotency } from "../utils/respondWithIdempotency.js";
import { getConfig } from "../config/paymentServiceConfig.js";

export const createOrder = async (req, res, next) => {
  try {
    const { razorpayKeyId } = getConfig();
    const {
      amount,
      currency = "INR",
      receipt,
      entityType,
      entityId,
      notes = {},
    } = req.body;

    const options = {
      amount: Math.round(amount * 100),
      currency,
      receipt,
    };

    const razorpayOrder = await getRazorpayInstance().orders.create(options);

    await Payment.create({
      razorpayOrderId: razorpayOrder.id,
      amount: options.amount,
      currency,
      receipt,
      status: "created",
      entityType,
      entityId,
      notes,
    });

    return respondWithIdempotency(req, res, 201, {
      success: true,
      orderId: razorpayOrder.id,
      amount: options.amount,
      currency,
      keyId: razorpayKeyId,
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message:
          "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      });
    }

    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (payment.status === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        entityType: payment.entityType,
        entityId: payment.entityId,
      });
    }

    const { razorpaySecret } = getConfig();
    const generatedSignature = crypto
      .createHmac("sha256", razorpaySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isSignatureValid = generatedSignature === razorpay_signature;

    if (!isSignatureValid) {
      payment.status = "failed";
      await payment.save();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    payment.status = "paid";
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      entityType: payment.entityType,
      entityId: payment.entityId,
    });
  } catch (error) {
    return next(error);
  }
};

export const initiateRefund = async (req, res, next) => {
  try {
    const { razorpayPaymentId, amount, reason } = req.body;

    if (!razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "razorpayPaymentId is required",
      });
    }

    const payment = await Payment.findOne({ razorpayPaymentId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "paid" && payment.status !== "partially_refunded") {
      return res.status(400).json({
        success: false,
        message: `Cannot refund a payment with status: ${payment.status}`,
      });
    }

    const remainingAmount = payment.amount - payment.amountRefunded;
    const refundAmount = amount ? Math.round(amount * 100) : remainingAmount;

    if (refundAmount <= 0 || refundAmount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Invalid refund amount. Maximum refundable: ${remainingAmount / 100}`,
      });
    }

    const razorpayRefund = await getRazorpayInstance().payments.refund(
      razorpayPaymentId,
      {
        amount: refundAmount,
      },
    );

    payment.refunds.push({
      razorpayRefundId: razorpayRefund.id,
      amount: refundAmount,
      status: "processing",
      reason: reason || null,
    });

    payment.amountRefunded += refundAmount;

    if (payment.amountRefunded >= payment.amount) {
      payment.status = "refunded";
    } else {
      payment.status = "partially_refunded";
    }

    await payment.save();

    return respondWithIdempotency(req, res, 200, {
      success: true,
      message: "Refund initiated",
      refundId: razorpayRefund.id,
      refundAmount,
      status: payment.status,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPaymentStatus = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;

    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: "entityType and entityId are required as query params",
      });
    }

    const payment = await Payment.findOne({ entityType, entityId }).sort({
      createdAt: -1,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "No payment found for this entity",
      });
    }

    return res.status(200).json({
      success: true,
      status: payment.status,
      amount: payment.amount,
      amountRefunded: payment.amountRefunded,
      currency: payment.currency,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      failureReason: payment.failureReason,
      refunds: payment.refunds,
      createdAt: payment.createdAt,
    });
  } catch (error) {
    return next(error);
  }
};
