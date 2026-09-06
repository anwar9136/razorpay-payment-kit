# Payment Service — Testing Guide

A complete reference for manually testing every endpoint and edge case in this payment module. Use this with Thunder Client / Postman. Keep this file updated whenever you add new behavior.

**Base URL (local):** `http://localhost:5000`
**Base URL (via ngrok, needed for webhook testing):** `https://<your-ngrok-id>.ngrok-free.dev`

Replace `YOUR_API_KEY` below with your actual `PAYMENT_SERVICE_API_KEY` value throughout.

---

## 0. Health Check

```
GET /
```
No headers needed.

**Expected:** `200` — `Payment service is running`

---

## 1. Create Order — `/api/payments/create-order`

### 1.1 ✅ Happy path

```
POST /api/payments/create-order
```

**Headers:**
```
Content-Type: application/json
x-api-key: YOUR_API_KEY
Idempotency-Key: test-create-001
```

**Body:**
```json
{
  "amount": 500,
  "currency": "INR",
  "receipt": "test-receipt-001",
  "entityType": "testOrder",
  "entityId": "test123",
  "notes": { "note": "manual test" }
}
```

**Expect:** `201`, response with `orderId`, `amount: 50000`, `currency`, `keyId`.
**Verify in DB:** New `Payment` doc, `status: "created"`.

---

### 1.2 🔁 Idempotency — same key, same request

Send the **exact same request** again (same `Idempotency-Key: test-create-001`).

**Expect:** `201` with the **identical** `orderId` as before.
**Verify in DB:** No new `Payment` document was created — count stays the same.

---

### 1.3 🚫 Missing Idempotency-Key header

Same body, but remove the `Idempotency-Key` header entirely.

**Expect:** `400` — `"Idempotency-Key header is required"`

---

### 1.4 🚫 Missing API key

Remove `x-api-key` header.

**Expect:** `401` — `"Missing API key"`

---

### 1.5 🚫 Wrong API key

```
x-api-key: some-wrong-value
```

**Expect:** `401` — `"Invalid API key"`

---

### 1.6 🚫 Validation — missing required field

**Body:**
```json
{
  "amount": 500,
  "receipt": "test-receipt-002"
}
```
(missing `entityType`, `entityId`)

**Expect:** `400` with `errors` array listing both missing fields.

---

### 1.7 🚫 Validation — negative amount

```json
{
  "amount": -100,
  "receipt": "test-receipt-003",
  "entityType": "testOrder",
  "entityId": "test124"
}
```

**Expect:** `400` — "Amount must be greater than 0"

---

### 1.8 🚫 Validation — amount exceeds max

```json
{
  "amount": 600000,
  "receipt": "test-receipt-004",
  "entityType": "testOrder",
  "entityId": "test125"
}
```

**Expect:** `400` — "Amount exceeds maximum allowed (₹5,00,000)"

---

### 1.9 🚫 Validation — bad currency code

```json
{
  "amount": 500,
  "currency": "DOLLAR",
  "receipt": "test-receipt-005",
  "entityType": "testOrder",
  "entityId": "test126"
}
```

**Expect:** `400` — "Currency must be a 3-letter code"

---

### 1.10 🐢 Rate limiting

Send **21 valid requests** in a row (use unique `Idempotency-Key` each time, e.g. `rate-test-1`, `rate-test-2`, ... `rate-test-21` — otherwise idempotency will short-circuit before rate limiting matters).

**Expect:** First 20 succeed (`201`), 21st returns `429` — "Too many requests. Please try again later."

> Wait 15 minutes (or restart server, since limiter is in-memory) before continuing other tests if you hit this.

---

## 2. Verify Payment — `/api/payments/verify-payment`

> This one requires a REAL order + REAL checkout completion (via your test HTML page), since a genuine signature can't be faked manually. Do a real test payment first, then test these variants using the real returned values.

### 2.1 ✅ Happy path

**Headers:**
```
Content-Type: application/json
x-api-key: YOUR_API_KEY
```

**Body:**
```json
{
  "razorpay_order_id": "order_XXXXXXXXXXXXX",
  "razorpay_payment_id": "pay_XXXXXXXXXXXXX",
  "razorpay_signature": "REAL_SIGNATURE_FROM_CHECKOUT"
}
```

**Expect:** `200`, `success: true`, `entityType`/`entityId` returned.
**Verify in DB:** `status: "paid"`, `razorpayPaymentId` and `razorpaySignature` filled in.

---

### 2.2 🔁 Idempotency (built-in, no header needed here)

Send the exact same body again.

**Expect:** `200` — `"Payment already verified"` (no re-processing, this is the internal idempotency check, not the Idempotency-Key header mechanism).

---

### 2.3 🚫 Missing fields

```json
{
  "razorpay_order_id": "order_XXXXXXXXXXXXX"
}
```

**Expect:** `400` — validation error listing missing `razorpay_payment_id`, `razorpay_signature`.

---

### 2.4 🚫 Tampered/fake signature

Use a real `order_id` and `payment_id`, but change the signature to a random string.

**Body:**
```json
{
  "razorpay_order_id": "order_XXXXXXXXXXXXX",
  "razorpay_payment_id": "pay_XXXXXXXXXXXXX",
  "razorpay_signature": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

**Expect:** `400` — "Payment verification failed"
**Verify in DB:** `status` becomes `"failed"` for that order (⚠️ only test this on a throwaway order, since it will mark a real payment as failed in your DB).

---

### 2.5 🚫 Order not found

```json
{
  "razorpay_order_id": "order_doesnotexist123",
  "razorpay_payment_id": "pay_doesnotexist123",
  "razorpay_signature": "anything"
}
```

**Expect:** `404` — "Order not found"

---

## 3. Refund — `/api/payments/refund`

> Requires a payment already in `status: "paid"` from a real test transaction.

### 3.1 ✅ Full refund (omit amount)

**Headers:**
```
Content-Type: application/json
x-api-key: YOUR_API_KEY
Idempotency-Key: refund-test-001
```

**Body:**
```json
{
  "razorpayPaymentId": "pay_XXXXXXXXXXXXX",
  "reason": "Testing full refund"
}
```

**Expect:** `200`, `status: "refunded"`.
**Verify in DB:** `amountRefunded === amount`, `refunds` array has one entry, `status: "processing"` initially.

---

### 3.2 ✅ Partial refund

Use a **different, fresh** paid payment for this one.

**Body:**
```json
{
  "razorpayPaymentId": "pay_YYYYYYYYYYYYY",
  "amount": 200,
  "reason": "Testing partial refund"
}
```

**Expect:** `200`, `status: "partially_refunded"`.

---

### 3.3 ✅ Second partial refund on the same payment

Refund the remaining amount on the same payment from 3.2, with a **new** `Idempotency-Key`.

**Expect:** `200`, `status: "refunded"` (now fully refunded across two refund events).
**Verify in DB:** `refunds` array now has 2 entries.

---

### 3.4 🚫 Refund exceeds remaining amount

Try to refund more than what's left (e.g., after 3.2/3.3, try refunding again).

**Expect:** `400` — "Invalid refund amount. Maximum refundable: X"

---

### 3.5 🚫 Refund a payment that was never paid

Use a `razorpayPaymentId` that's still `null`/nonexistent, or a payment stuck at `status: "created"`.

**Expect:** `400` — "Cannot refund a payment with status: created" (or `404` if the payment ID doesn't exist at all)

---

### 3.6 🔁 Idempotency on refund

Repeat 3.1 exactly (same `Idempotency-Key: refund-test-001`).

**Expect:** Identical response, no second refund actually issued (check Razorpay dashboard — should still show only 1 refund for that payment).

---

## 4. Get Payment Status — `/api/payments/status`

### 4.1 ✅ Happy path

```
GET /api/payments/status?entityType=testOrder&entityId=test123
```

**Headers:**
```
x-api-key: YOUR_API_KEY
```

**Expect:** `200`, full payment object (status, amounts, refunds array, etc.)

---

### 4.2 🚫 Missing query params

```
GET /api/payments/status?entityType=testOrder
```

**Expect:** `400` — "entityId is required"

---

### 4.3 🚫 No payment exists for this entity

```
GET /api/payments/status?entityType=testOrder&entityId=doesnotexist999
```

**Expect:** `404` — "No payment found for this entity"

---

## 5. Webhook — `/api/payments/webhook`

> Cannot be tested via Thunder Client alone with a fake body — Razorpay signs the raw payload, so you can't hand-craft a valid signature without the actual webhook secret math. Best tested via real events.

### 5.1 ✅ Real test — trigger via actual test payment

1. Make sure ngrok is running and the webhook URL is set correctly in Razorpay's dashboard
2. Complete a real test payment via your HTML test page
3. Watch your server terminal — you should see either:
   - `"Payment ... confirmed via webhook"` (if webhook arrives before your frontend's verify-payment call), OR
   - Silent no-op with `"already processed, skipping"` log (if verify-payment already handled it)
4. Check ngrok's local inspector at `http://127.0.0.1:4040` to see the raw webhook payload Razorpay sent

---

### 5.2 ✅ Real refund webhook

1. Trigger a refund via `/refund` (Section 3)
2. Within a few minutes, check your terminal for `"Refund ... confirmed as processed"`
3. Verify in DB: that specific refund's `status` flips from `"processing"` to `"processed"`

---

### 5.3 🚫 Manual bad-signature test (optional, advanced)

If you want to confirm signature rejection works, send any POST to `/api/payments/webhook` with a random body and a fake `x-razorpay-signature` header. Since this route uses `express.raw()`, use Thunder Client's "raw" body type (not JSON) for the body.

**Expect:** `400` — "Invalid signature". Should NOT crash the server.

---

## 6. Error Handling Sanity Checks

### 6.1 Trigger a generic server error

Temporarily disconnect MongoDB (stop local MongoDB service, or use a wrong `MONGO_URI` briefly) and hit any endpoint.

**Expect:** Clean `500` JSON response (not a raw stack trace or crash), and a `[ERROR] METHOD /path: ...` line in your terminal/log file.

---

### 6.2 Check logs are actually being written

After running a batch of the tests above:
```bash
cat logs/access.log
```
**Expect:** One line per request, in `combined` format, including timestamps and status codes.

---

## Quick Reference Table

| Endpoint | Method | Auth | Idempotency-Key | Rate Limit Tier |
|---|---|---|---|---|
| `/` | GET | No | No | None |
| `/api/payments/create-order` | POST | Yes | **Required** | Strict (20/15min) |
| `/api/payments/verify-payment` | POST | Yes | No (built-in check) | Strict (20/15min) |
| `/api/payments/refund` | POST | Yes | **Required** | Strict (20/15min) |
| `/api/payments/status` | GET | Yes | No | Read (60/15min) |
| `/api/payments/webhook` | POST | No (signature-based) | No | None |

---

## Testing Checklist (Copy This Before a Big Test Session)

- [ ] Health check responds
- [ ] Create order — happy path
- [ ] Create order — idempotency (duplicate key → same response, no dupe in DB)
- [ ] Create order — missing/wrong API key
- [ ] Create order — missing Idempotency-Key
- [ ] Create order — all validation edge cases (negative, too large, bad currency, missing fields)
- [ ] Create order — rate limit trips at 21st request
- [ ] Real checkout via test HTML page completes successfully
- [ ] Verify payment — happy path, DB updates correctly
- [ ] Verify payment — idempotent on repeat call
- [ ] Verify payment — tampered signature correctly marks `failed`
- [ ] Webhook — payment.captured log appears, idempotency no-ops if already verified
- [ ] Refund — full refund happy path
- [ ] Refund — partial refund, then second partial refund completes it
- [ ] Refund — over-refund correctly rejected
- [ ] Refund — idempotency prevents double refund on retry
- [ ] Webhook — refund.processed flips refund sub-status
- [ ] Status — happy path returns full object
- [ ] Status — missing params / not found handled correctly
- [ ] Error handler — DB disconnect produces clean 500, not a crash
- [ ] Logs — `logs/access.log` populating correctly
