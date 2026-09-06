let config = null;

export const initPaymentService = (options) => {
  const required = ['razorpayKeyId', 'razorpaySecret', 'webhookSecret', 'apiKey'];
  const missing = required.filter((key) => !options?.[key]);

  if (missing.length > 0) {
    throw new Error(`initPaymentService is missing required options: ${missing.join(', ')}`);
  }

  config = options;
};

export const getConfig = () => {
  if (!config) {
    throw new Error(
      'Payment service not initialized. Call initPaymentService({ razorpayKeyId, razorpaySecret, webhookSecret, apiKey }) before using any payment routes.'
    );
  }
  return config;
};