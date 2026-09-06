const requiredEnvVars = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'MONGO_URI',
    'PAYMENT_SERVICE_API_KEY'
];

const validateEnv = () => {
    const missing = requiredEnvVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach((key) => console.log(`   - ${key}`));
        console.error('\nCheck your .env file and try again.');
        process.exit(1);
    }
    console.log('✅ Environment variables validated');
};

export default validateEnv;