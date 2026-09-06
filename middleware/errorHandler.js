export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);

  if (err.type === 'entity.parse.failed' || err.statusCode === 400 || err.name === 'SyntaxError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON payload',
    });
  }

  // Handle known Mongoose/MongoDB errors with clearer messages
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Database validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry — this record already exists',
    });
  }

  // Razorpay SDK errors often come with a statusCode + error.description
  if (err.statusCode && err.error) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.error.description || 'Payment gateway error',
    });
  }

  // Fallback for anything unexpected
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.',
  });
};