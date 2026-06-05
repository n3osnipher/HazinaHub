# M-Pesa Callback URLs Setup Guide

This guide explains how to obtain and configure the callback URLs for your HazinaHub M-Pesa integration.

## 1. Local Development (using ngrok)

Since Safaricom's servers need to "talk" to your local machine, you need a public tunnel.

1.  **Install ngrok**: Download it from [ngrok.com](https://ngrok.com/).
2.  **Start your API server**: Ensure your backend is running (typically on port 5000).
    ```bash
    npm run dev
    ```
3.  **Start ngrok**:
    ```bash
    ngrok http 5000
    ```
4.  **Copy the Forwarding URL**: It will look like `https://a1b2-c3d4.ngrok-free.app`.
5.  **Update your `.env`**:
    - `MPESA_CALLBACK_URL`: `https://[your-ngrok-url]/api/transactions/mpesa/stk/callback`
    - `MPESA_C2B_CONFIRMATION_URL`: `https://[your-ngrok-url]/api/transactions/mpesa/c2b/confirm`
    - `MPESA_C2B_VALIDATION_URL`: `https://[your-ngrok-url]/api/transactions/mpesa/c2b/validate`

## 2. Production Setup

In production, replace the ngrok URL with your actual domain:

- `https://api.hazinahub.co.ke/api/transactions/mpesa/stk/callback`
- `https://api.hazinahub.co.ke/api/transactions/mpesa/c2b/confirm`
- `https://api.hazinahub.co.ke/api/transactions/mpesa/c2b/validate`

## 3. Registering C2B URLs

For C2B (Customer to Business) payments to work, you must register these URLs with Safaricom once.

### Using Daraja Portal (Sandbox)

1.  Go to the [Daraja Portal](https://developer.safaricom.co.ke/).
2.  Navigate to **APIs** -> **C2B** -> **Register URL**.
3.  Fill in the Shortcode and the Confirmation/Validation URLs from your `.env`.

### Using Script (Automated)

Your codebase has the logic to do this via the API. Ensure your `MPESA_C2B_CONFIRMATION_URL` and `MPESA_C2B_VALIDATION_URL` are set in `.env`, then you can trigger a registration call (if implemented in your services).

## Callback Paths in HazinaHub

Based on your current code in `apps/api/src/server.ts` and `apps/api/src/routes/transaction.routes.ts`:

- **Server Prefix**: `/api`
- **Transaction Routes Prefix**: `/transactions`
- **STK Callback Path**: `/mpesa/stk/callback`
- **Combined Path**: `/api/transactions/mpesa/stk/callback`
