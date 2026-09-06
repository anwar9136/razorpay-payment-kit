import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import connectDB from '../config/db.js';
import paymentRouter from '../routes/paymentRoutes.js';
import validateEnv from '../config/validateEnv.js';
import { errorHandler } from '../middleware/errorHandler.js';
import morgan from 'morgan';
import {createStream} from 'rotating-file-stream';
import path from 'path';
import { initPaymentService } from '../config/paymentServiceConfig.js';


validateEnv();
initPaymentService({
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpaySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  apiKey: process.env.PAYMENT_SERVICE_API_KEY,
});
const app = express();

const accessLogStream = createStream('access.log', {
  interval: '1d', // rotate daily
  path: path.join(process.cwd(), 'logs'),
});

app.use(morgan('combined', { stream: accessLogStream }));

app.use(morgan('dev'));

app.use(cors());

app.get('/', (req, res) => {
  res.send('Payment service is running');
});

app.use('/api/payments', paymentRouter);
app.use(errorHandler);
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Dev server running on port ${PORT}`);
  });
});