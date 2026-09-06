# Payment Service — Reusable Razorpay Payment Module

![npm version](https://img.shields.io/npm/v/razorpay-payment-kit)
![npm downloads](https://img.shields.io/npm/dm/razorpay-payment-kit)
![license](https://img.shields.io/npm/l/razorpay-payment-kit)

A standalone, drop-in Razorpay payment module built for reuse across freelance MERN projects. Each project gets its own copy of this module, its own database, and its own Razorpay account — no shared infrastructure between clients.

This document is written so you (or anyone else) can understand and integrate this module **without reading the source code**.

---

## 1. What This Module Does (and Doesn't Do)

**Does:**
- Creates Razorpay orders
- Verifies payment signatures (proves a payment is genuine)
- Handles Razorpay webhooks reliably (payment success/failure, refund confirmation)
- Issues full and partial refunds
- Lets a host project check payment status anytime
- Protects itself with API key auth, rate limiting, idempotency, and input validation

**Does NOT do:**
- Know or care about your business domain (orders, bookings, enrollments, etc.) — you tell it via `entityType` / `entityId`
- Update your project's own database/business records — that's always your project's job, based on this module's response
- Store any card/UPI details — Razorpay's checkout handles that entirely; this module never sees sensitive payment info

---

## 2. How It Fits Into a Project

```
Customer's Browser (checkout page)
        │
        ▼
Host Project's Own Backend  ◄────── holds the PAYMENT_SERVICE_API_KEY safely
        │  (npm-installed package, mounted as a router,
        │   using the host's own Express app + own MongoDB connection)
        ▼
This Payment Module (razorpay-payment-kit)
        │
        ▼
   Razorpay's API
```

This module is **not** a separate running server — it's an installable npm package that plugs directly into your host project's existing Express app and existing MongoDB connection. There is no separate port, no separate database, no separate deployment. One copy of your host app, one payment router mounted inside it.

The customer's browser never talks to this module directly in production — it talks to your host project's backend, which calls this module's router internally (in-process, not over the network) using your host app's own request pipeline. (Our test HTML page called a locally-running dev instance of this module directly from the browser purely for testing convenience — don't do that in a real deployment.)

---

## 2.1 Installation & Quick Start

```bash
npm install razorpay-payment-kit
```

**Peer dependencies** — your host project must already have these installed (this package will not install its own separate copies):
```bash
npm install express mongoose
```

**In your host project's own server file:**

```javascript
import express from 'express';
import mongoose from 'mongoose';
import { paymentRouter, initPaymentService } from 'razorpay-payment-kit';

const app = express();

// 1. Your project's OWN MongoDB connection — the package reuses this automatically
await mongoose.connect(process.env.MONGO_URI);

// 2. Initialize the package ONCE, before mounting the router.
//    Read these values however your project normally reads its own .env —
//    this package never reads process.env directly.
initPaymentService({
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpaySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  apiKey: process.env.PAYMENT_SERVICE_API_KEY,
});

// 3. Mount it under whatever path you like
app.use('/api/payments', paymentRouter);

app.listen(3000);
```

That's the entire integration — no copy-pasting folders, no separate `.env` inside a nested module, no separate server process. `initPaymentService()` must run before any request hits the router, or the router's middleware/controllers will throw `"Payment service not initialized"` — this is intentional, so misconfiguration fails loudly at request time rather than silently.

> Advanced: `createPaymentRouter()` is also exported if you ever need to build a fresh router instance yourself (e.g., mounting it more than once with different behavior). For nearly all use cases, the ready-made `paymentRouter` is what you want.

---

## 3. Project Structure

```
razorpay-payment-kit/
├── index.js                → PUBLIC entry point — the only file host projects import from
├── config/
│   ├── paymentServiceConfig.js → initPaymentService() / getConfig() — the config singleton
│   ├── razorpay.js         → Razorpay SDK instance (lazily built from getConfig())
│   ├── db.js               → DEV-ONLY MongoDB connection, used only by dev/server.js
│   └── validateEnv.js      → DEV-ONLY .env check, used only by dev/server.js
├── controllers/
│   ├── paymentController.js  → createOrder, verifyPayment, initiateRefund, getPaymentStatus
│   └── webhookController.js  → handleWebhook
├── middleware/
│   ├── authMiddleware.js   → API key check
│   ├── rateLimiter.js      → strictLimiter, readLimiter
│   ├── idempotency.js      → Idempotency-Key handling
│   ├── validate.js         → Zod validation middleware factory
│   └── errorHandler.js     → Centralized error handling
├── models/
│   ├── Payment.js          → Core payment + nested refunds
│   └── IdempotencyKey.js   → Tracks processed idempotency keys (auto-expires in 24h)
├── validators/
│   └── paymentValidators.js → Zod schemas for each endpoint
├── routes/
│   └── paymentRoutes.js    → exports both `paymentRouter` (ready-made) and `createPaymentRouter` (factory)
├── utils/
│   └── respondWithIdempotency.js
├── dev/
│   └── server.js           → DEV-ONLY standalone test harness — NOT part of the published package
├── logs/                    → dev-only, rotating daily access logs (gitignored)
├── package.json
└── .env                     → dev-only, used only when running dev/server.js locally (gitignored)
```

**Important distinction:** only `index.js`, `config/paymentServiceConfig.js`, `config/razorpay.js`, `controllers/`, `middleware/`, `models/`, `routes/`, `utils/`, `validators/` are actually published to npm (see the `files` field in `package.json`). `dev/`, `config/db.js`, `config/validateEnv.js`, `.env`, and `logs/` exist purely to let *this repo* be developed and tested standalone — a host project never sees or needs them.

---

## 4. Configuration — `initPaymentService()`

**This package never reads `process.env` directly.** Instead, your host project reads its own environment variables however it normally does, and passes them into `initPaymentService()` once, at startup:

```javascript
initPaymentService({
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpaySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  apiKey: process.env.PAYMENT_SERVICE_API_KEY,
});
```

| Config key | What it is |
|---|---|
| `razorpayKeyId` | Your Razorpay Key ID (test or live) |
| `razorpaySecret` | Your Razorpay Key Secret |
| `webhookSecret` | The secret you set when configuring the webhook in Razorpay's dashboard |
| `apiKey` | A random string YOU generate — protects this package's routes from unauthenticated callers |

Generate a strong `apiKey` with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If `initPaymentService()` is never called, or is called with a missing field, any request to the router will fail immediately with a clear error (`"Payment service not initialized"` or `"initPaymentService is missing required options: ..."`) — this is intentional, so misconfiguration is caught immediately rather than causing confusing failures deep inside a controller.

> Note: your **own project's** `.env` variable *names* don't need to match the ones shown above — call them whatever fits your project's conventions. What matters is the shape of the object you pass into `initPaymentService()`.

### For developing THIS package itself (not relevant to host projects)

If you're working on this package's own source code and running `dev/server.js` to test it standalone, that dev harness does read a local `.env` directly (see `.env.example`) and calls `validateEnv()` + `initPaymentService()` itself, simulating what a real host project would do.

---

## 5. Razorpay Dashboard Setup Checklist

1. Generate Test Mode API keys: **Account & Settings → API Keys → Generate Key**
2. Set up a webhook: **Account & Settings → Webhooks → Add New Webhook**
   - URL: `https://<your-domain-or-ngrok-url>/api/payments/webhook`
   - Active events: `payment.captured`, `payment.failed`, `refund.processed`
   - Set your own webhook secret — this must match `RAZORPAY_WEBHOOK_SECRET`
3. For local development, use `ngrok http 5000` to expose your server, and update the webhook URL in Razorpay's dashboard to the ngrok URL (changes each time you restart ngrok on the free plan).

---

## 6. Core Concepts (Read Before Integrating)

- **Order ID vs Payment ID**: An order (`razorpayOrderId`) represents intent to pay. A payment (`razorpayPaymentId`) represents one specific attempt — one order can have multiple attempts if earlier ones fail.
- **Two independent confirmation paths**: Payment success reaches you via (1) the frontend calling `verify-payment` right after checkout, AND (2) Razorpay's webhook, independently. Whichever arrives first marks the payment `paid`; idempotency guards prevent double-processing.
- **entityType / entityId**: This module has no concept of "Order" or "Booking" — you tell it what the payment is for via these two fields, and it stores them for you to query later. This is what keeps the module domain-agnostic and reusable.
- **Idempotency Keys**: Required on `create-order` and `refund`. Generate a fresh UUID per logical operation; reuse the same UUID if retrying the same operation after a network failure.

---

## 7. API Reference

Base URL: `http://localhost:5000/api/payments` (replace with your deployed URL)

All routes (except `/webhook`) require this header:
```
x-api-key: <your PAYMENT_SERVICE_API_KEY>
```

### 7.1 Create Order

```
POST /create-order
```

**Headers:**
```
x-api-key: <your key>
Idempotency-Key: <unique UUID per order attempt>
Content-Type: application/json
```

**Body:**
```json
{
  "amount": 500,
  "currency": "INR",
  "receipt": "saree-order-001",
  "entityType": "Order",
  "entityId": "66f1a2b3c4d5e6f7g8h9",
  "notes": { "couponCode": "FESTIVE10" }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| amount | number | Yes | In rupees (not paise). Max 500000. |
| currency | string | No | Defaults to `INR`. Must be 3 letters. |
| receipt | string | Yes | Your own reference label, shown in Razorpay dashboard |
| entityType | string | Yes | e.g. `"Order"`, `"Booking"`, `"Enrollment"` |
| entityId | string | Yes | The ID from YOUR project's own database |
| notes | object | No | Any extra arbitrary context |

**Success response (201):**
```json
{
  "success": true,
  "orderId": "order_XXXXXXXXXXXXX",
  "amount": 50000,
  "currency": "INR",
  "keyId": "rzp_test_XXXXXXXXXXXXX"
}
```
> `orderId` and `keyId` are what your frontend needs to open Razorpay Checkout.

**Error responses:** `400` (validation failed), `401` (bad/missing API key), `429` (rate limited), `409` (duplicate idempotency key in progress), `500` (server/Razorpay error)

---

### 7.2 Opening Razorpay Checkout (Frontend Reference)

After `create-order` succeeds, your frontend does:

```javascript
const options = {
  key: data.keyId,
  amount: data.amount,
  currency: data.currency,
  order_id: data.orderId,
  name: "Your Business Name",
  description: "Order description",
  handler: function (response) {
    // response.razorpay_order_id
    // response.razorpay_payment_id
    // response.razorpay_signature
    // → send these three to /verify-payment next
  }
};

const razorpay = new Razorpay(options);
razorpay.open();
```

Include this script tag on the checkout page:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

### 7.3 Verify Payment

```
POST /verify-payment
```

**Headers:**
```
x-api-key: <your key>
Content-Type: application/json
```

**Body:**
```json
{
  "razorpay_order_id": "order_XXXXXXXXXXXXX",
  "razorpay_payment_id": "pay_XXXXXXXXXXXXX",
  "razorpay_signature": "generated_signature_string"
}
```

**Success response (200):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "entityType": "Order",
  "entityId": "66f1a2b3c4d5e6f7g8h9"
}
```

> Use `entityType`/`entityId` from this response to update YOUR OWN project's database (e.g., mark the order confirmed). This module never touches your project's data directly.

**Error responses:** `400` (missing fields or invalid signature — payment marked `failed`), `401`, `404` (order not found), `429`

---

### 7.4 Initiate Refund

```
POST /refund
```

**Headers:**
```
x-api-key: <your key>
Idempotency-Key: <unique UUID per refund attempt>
Content-Type: application/json
```

**Body:**
```json
{
  "razorpayPaymentId": "pay_XXXXXXXXXXXXX",
  "amount": 200,
  "reason": "Customer returned 1 item"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| razorpayPaymentId | string | Yes | The payment to refund |
| amount | number | No | In rupees. Omit to refund full remaining amount. |
| reason | string | No | For your own record-keeping only |

**Success response (200):**
```json
{
  "success": true,
  "message": "Refund initiated",
  "refundId": "rfnd_XXXXXXXXXXXXX",
  "refundAmount": 20000,
  "status": "partially_refunded"
}
```
`status` will be either `"partially_refunded"` or `"refunded"` depending on whether anything remains refundable.

**Error responses:** `400` (invalid amount / can't refund this payment's current status), `401`, `404` (payment not found), `429`

---

### 7.5 Get Payment Status

```
GET /status?entityType=Order&entityId=66f1a2b3c4d5e6f7g8h9
```

**Headers:**
```
x-api-key: <your key>
```

**Success response (200):**
```json
{
  "success": true,
  "status": "paid",
  "amount": 50000,
  "amountRefunded": 0,
  "currency": "INR",
  "razorpayOrderId": "order_XXXXXXXXXXXXX",
  "razorpayPaymentId": "pay_XXXXXXXXXXXXX",
  "failureReason": null,
  "refunds": [],
  "createdAt": "2026-08-20T10:15:00.000Z"
}
```

`status` values: `created` | `paid` | `failed` | `partially_refunded` | `refunded`

**Error responses:** `400`, `401`, `404` (no payment found for this entity), `429`

---

### 7.6 Webhook (Razorpay → This Server, Not For Frontend Use)

```
POST /api/payments/webhook
```

This is called by Razorpay's servers directly, authenticated via signature (not API key). No frontend integration needed — just make sure the URL is registered correctly in Razorpay's dashboard (see Section 5). Handles `payment.captured`, `payment.failed`, `refund.processed`.

---

## 8. Building a Frontend — Quick Integration Checklist

1. Checkout page loads → button click → your **backend** calls `POST /create-order` (server-to-server, with API key)
2. Backend returns `orderId`, `amount`, `currency`, `keyId` to your frontend
3. Frontend opens Razorpay Checkout using those 4 values (see 7.2)
4. On success, Razorpay's `handler` fires with 3 values → frontend sends them to your **backend**
5. Your backend calls `POST /verify-payment` (server-to-server) with those 3 values
6. On success, your backend updates YOUR OWN database using the returned `entityType`/`entityId`, then tells your frontend "success" → show confirmation UI
7. Anytime later (order history page, admin dashboard, support lookup) → your backend calls `GET /status` to display current payment state, including refund history

**Never call this module's API key–protected routes directly from the browser in production** — always proxy through your own backend, which is the only place the API key should live.

---

## 9. Security Features Already Built In

| Feature | Purpose |
|---|---|
| API Key Auth | Only your own backend can call this module |
| Rate Limiting | 20 req/15min on write routes, 60 req/15min on status lookups, per IP |
| Idempotency Keys | Prevents duplicate orders/refunds from network retries |
| Zod Validation | Rejects malformed/out-of-range input before it reaches business logic |
| Signature Verification | Cryptographically proves a payment/webhook is genuinely from Razorpay |
| Centralized Error Handling | Consistent error responses, no leaked stack traces |
| Request Logging | Every request logged to console (dev) and `logs/access.log` (rotates daily) |

---

## 10. Known Limitations / Future Improvements

- Rate limiting is in-memory — fine for single server instance; needs a Redis-backed store if you ever run multiple instances of your host app behind a load balancer
- No automated test suite yet — currently verified via manual Postman/Thunder Client + browser testing, and via `npm link` against a throwaway host project
- `refund.failed` webhook event isn't specifically handled yet (rare in practice)
- Each host project still needs its own Razorpay account/keys and its own MongoDB — this package does not centralize payments across multiple unrelated projects (a deliberate architectural choice, see Section 2)

---

## 11. Deploying to Production (When Ready)

- Switch `.env` Razorpay keys from Test Mode to Live Mode
- Update the webhook URL in Razorpay's dashboard to your real deployed HTTPS URL (ngrok is dev-only)
- Razorpay requires HTTPS for live-mode webhooks — most hosting platforms (Render, Railway, etc.) provide this by default
- Double check `MONGO_URI` points to your production database, not local/test

---

## 12. Full Request Lifecycle (For Reference)

> Note: "Host backend → POST /create-order" below refers to an HTTP request from your frontend to your own backend's mounted route (e.g. `POST /api/payments/create-order` on YOUR server) — since this package is mounted directly into your host app, there's no separate network hop to a different server. Internally, your Express app just routes that request into this package's router.

```
1. Frontend click "Pay" 
        → Host backend → POST /create-order → Razorpay creates order
        → razorpayOrderId returned, Payment doc saved (status: created)

2. Frontend opens Razorpay Checkout popup using orderId

3. Customer pays → Razorpay returns razorpay_order_id, razorpay_payment_id, razorpay_signature

4. Frontend → Host backend → POST /verify-payment
        → Signature verified → Payment doc updated (status: paid)
        → entityType/entityId returned to host backend
        → Host backend updates ITS OWN business data (e.g. Order.status = "confirmed")

5. [Independently, possibly before or after step 4]
   Razorpay → POST /api/payments/webhook (payment.captured)
        → Idempotency check: if already 'paid', no-op
        → Otherwise, marks Payment 'paid' the same way

6. [Whenever needed later]
   Host backend → POST /refund → Razorpay processes refund
        → Payment doc updated: refunds[] appended, status → partially_refunded/refunded

7. Razorpay → POST /api/payments/webhook (refund.processed)
        → Confirms that specific refund's status → processed

8. [Anytime]
   Host backend → GET /status?entityType=X&entityId=Y → current full state
```
