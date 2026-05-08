# Payment Processing System (Mid-Level Backend)

A robust Node.js/PostgreSQL payment processing system designed to handle real-world distributed system challenges including network instability, race conditions, and duplicate requests.

## 🚀 Features

### 1. Idempotency & Safety

* **Idempotency Headers:** Uses `Idempotency-Key` to ensure that duplicate API requests result in only one transaction.
* **Concurrency Control:** Implements **Pessimistic Locking** using PostgreSQL `SELECT ... FOR UPDATE` to prevent race conditions during concurrent processing.

### 2. Resilience & Error Handling

* **State Machine:** Strict transitions between `pending`, `processing`, `success`, and `failed`. Final states are protected from being overwritten by delayed webhooks.
* **Atomic Transactions:** All status changes and event logs are wrapped in ACID-compliant database transactions.

### 3. Gateway Simulation

* Simulates network latency ($200ms - 2000ms$).
* Mimics 5% timeout rates and 20% random gateway failures.
* Distinguishes between **Retryable Errors** (e.g., Timeout) and **Non-Retryable Errors** (e.g., Card Declined).

## 🛠️ Architecture

* **Express.js:** API Layer.
* **PostgreSQL:** Primary data store and locking mechanism.
* **Service Layer:** Orchestrates business logic and transactions.
* **Background Worker:** Polling mechanism for automated retries.

## 📖 API Reference

### Create Payment

`POST /payments`
**Headers:** `Idempotency-Key: <UUID>`
**Body:**

```json
{
  "amount": 1000,
  "currency": "USD"
}

```

### Get Payment Status

`GET /payments/:id`

## ⚙️ Setup

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Configure `.env` with your PostgreSQL credentials.
4. Start the server: `node app.js`.
5. Start the background worker: `node worker.js`.
