import crypto from 'node:crypto';
import { safeEqual } from './codes.js';

const hmacHex = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

/**
 * Thin Razorpay client over its REST API (no SDK needed).
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */
export function createRazorpay({ keyId, keySecret, webhookSecret, apiBase }) {
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  async function call(method, path, body) {
    const res = await fetch(apiBase + path, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Razorpay ${method} ${path} → ${res.status} ${data?.error?.description || ''}`.trim());
    }
    return data;
  }

  return {
    keyId,

    /** A Razorpay "order" locks the amount, so the customer cannot pay less than the total. */
    createOrder: ({ amount, receipt, notes }) => call('POST', '/orders', { amount, currency: 'INR', receipt, notes }),

    fetchOrderPayments: async (orderId) => (await call('GET', `/orders/${encodeURIComponent(orderId)}/payments`)).items || [],

    fetchPayment: (paymentId) => call('GET', `/payments/${encodeURIComponent(paymentId)}`),

    capturePayment: (paymentId, amount) =>
      call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: 'INR' }),

    /** Checkout hands the browser {order_id, payment_id, signature}; only Razorpay + us know the secret. */
    verifyCheckoutSignature: ({ orderId, paymentId, signature }) =>
      Boolean(orderId && paymentId && signature) && safeEqual(hmacHex(keySecret, `${orderId}|${paymentId}`), signature),

    /** Webhooks are signed over the exact raw request body. */
    verifyWebhookSignature: (rawBody, signature) =>
      Boolean(webhookSecret && signature) && safeEqual(hmacHex(webhookSecret, rawBody), signature),
  };
}
