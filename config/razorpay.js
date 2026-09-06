import Razorpay from 'razorpay';
import { getConfig } from './paymentServiceConfig.js';

let razorpayInstance = null;

export const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    const { razorpayKeyId, razorpaySecret } = getConfig();
    razorpayInstance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpaySecret,
    });
  }
  return razorpayInstance;
};