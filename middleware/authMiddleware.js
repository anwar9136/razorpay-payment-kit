import { getConfig } from "../config/paymentServiceConfig.js";

export const verifyApiKey = (req, res, next) => {
  const {apiKey} = getConfig()
  const providedKey = req.headers['x-api-key'];

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      message: 'Missing API key',
    });
  }

  if (providedKey !== apiKey) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key',
    });
  }

  next();
};