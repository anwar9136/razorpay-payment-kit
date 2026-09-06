import mongoose from 'mongoose';

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed'],
      default: 'processing',
    },
    responseStatusCode: {
      type: Number,
      default: null,
    },
    responseBody: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-delete these records after 24 hours — we don't need to remember keys forever
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.models.IdempotencyKey || mongoose.model('IdempotencyKey', idempotencyKeySchema);