import IdempotencyKey from '../models/IdempotencyKey.js';

export const idempotencyCheck = async (req, res, next) => {
  const key = req.headers['idempotency-key'];

  if (!key) {
    return res.status(400).json({
      success: false,
      message: 'Idempotency-Key header is required',
    });
  }

  try {
    const existing = await IdempotencyKey.findOne({ key });

    if (existing) {
      if (existing.status === 'completed') {
        // We've already processed this exact operation — return the same response
        return res.status(existing.responseStatusCode).json(existing.responseBody);
      }

      // Still processing (a near-simultaneous duplicate request)
      return res.status(409).json({
        success: false,
        message: 'This request is already being processed',
      });
    }

    // First time seeing this key — try to claim it
    await IdempotencyKey.create({ key, status: 'processing' });

    // Attach the key to req so the controller can save the final response against it
    req.idempotencyKey = key;
    next();
  } catch (error) {
    // Handle the race condition: two requests hit findOne at the same instant,
    // both see "no existing record", both try to create — the unique index stops the second one
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This request is already being processed',
      });
    }

    console.error('Idempotency check error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};