import mongoose from 'mongoose';


const refundSchema = new mongoose.Schema({
  razorpayRefundId:{
    type: String,
    required: true,
  },
  amount:{
    type: Number,
    required: true,
  },
  status:{
    type: String,
    enum: ['processing', 'processed', 'failed'],
    default: 'processing',
  },
  reason:{
    type: String,
    default: null,
  },
},{ timestamps: true })


const paymentSchema = new mongoose.Schema(
  {
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    receipt: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed','partially_refunded','refunded'],
      default: 'created',
    },
    failureReason:{
      type: String,
      default: null,
    },
    entityType: {
      type: String,
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    notes: {
      type: Object,    
      default: {},
    },
    refunds: {
      type: [refundSchema],
      default: [],
    },
    amountRefunded: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// We'll query by these often, so index them
paymentSchema.index({ entityType: 1, entityId: 1 });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);