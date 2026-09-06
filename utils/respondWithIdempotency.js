import IdempotencyKey from '../models/IdempotencyKey.js';

export const respondWithIdempotency = async (req, res, statusCode, body) => {
  if (req.idempotencyKey) {
    await IdempotencyKey.findOneAndUpdate(
      { key: req.idempotencyKey },
      { status: 'completed', responseStatusCode: statusCode, responseBody: body }
    );
  }

  return res.status(statusCode).json(body);
};