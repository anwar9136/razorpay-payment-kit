import rateLimit from 'express-rate-limit';

// For sensitive, state-changing routs: create-order, verify-payment, refund
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per IP per window
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true, // sends RateLimit-* headers so clients know their limit status
  legacyHeaders: false,  // disables the older X-RateLimit-* headers (redundant with standardHeaders)
});

// For read-only lookups: status endpoint
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // more generous, since it's read-only
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});