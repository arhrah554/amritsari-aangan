import QRCode from 'qrcode';
import {
  formatTicketId,
  newAccessToken,
  newOrderId,
  newTicketId,
  parseScan,
  qrPayload,
  ticketCode,
  verifyTicketSig,
} from './codes.js';
import { passEmail } from './email-template.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

const ORDER_LOCK = 727001; // serialises "check stock → reserve" so two buyers can't both get the last pass
const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const SHOW_LEFT_BELOW = 25; // only reveal "X left" when stock is actually low

export function createService({ db, cfg, event, razorpay, mailer, secrets }) {
  // Work we don't make the buyer wait for (emails, capture checks). On a normal server it just runs;
  // the Netlify function awaits drain() before returning, because a frozen function never finishes it.
  const background = new Set();
  const track = (promise, label) => {
    const p = promise.catch((err) => console.error(`[${label}]`, err.message)).finally(() => background.delete(p));
    background.add(p);
  };
  const drain = () => Promise.allSettled([...background]);

  const passById = new Map(event.passes.map((p) => [p.id, p]));
  const passRank = new Map(event.passes.map((p, i) => [p.id, i]));
  const byPassRank = (a, b) => (passRank.get(a.pass_id) ?? 99) - (passRank.get(b.pass_id) ?? 99);
  const scanKinds = ['entry', ...Object.keys(event.perks)];
  const perkLabel = (kind) => (kind === 'entry' ? 'Entry' : event.perks[kind]?.label || kind);
  const passUrl = (token) => `${cfg.publicUrl}/p/${token}`;
  const passInfo = (passId) =>
    passById.get(passId) || { id: passId, name: passId, emoji: '🎟️', audience: 'all', includes: ['Entry'], redeem: [] };

  // ── validation ────────────────────────────────────────────────────────────

  function cleanPhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return PHONE_RE.test(d) ? d : null;
  }

  function validateBuyer(input, { emailRequired }) {
    const name = String(input.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) throw new HttpError(400, 'Please enter your full name.');
    const phone = cleanPhone(input.phone);
    if (!phone) throw new HttpError(400, 'Please enter a valid 10-digit Indian mobile number.');
    const email = String(input.email || '').trim().toLowerCase();
    if ((emailRequired || email) && (email.length > 120 || !EMAIL_RE.test(email))) {
      throw new HttpError(400, 'Please enter a valid email address.');
    }
    return { name, phone, email };
  }

  function validateItems(rawItems, maxQty) {
    if (!Array.isArray(rawItems)) throw new HttpError(400, 'Pick at least one pass.');
    const qtyByPass = new Map();
    for (const item of rawItems) {
      const pass = passById.get(item?.passId);
      const qty = Number(item?.qty);
      if (!pass || !pass.active) throw new HttpError(400, 'One of those passes is not on sale.');
      if (!Number.isInteger(qty) || qty < 0) throw new HttpError(400, 'Invalid quantity.');
      if (qty) qtyByPass.set(pass.id, (qtyByPass.get(pass.id) || 0) + qty);
    }
    const items = [...qtyByPass].map(([id, qty]) => ({ pass: passById.get(id), qty }));
    const total = items.reduce((s, i) => s + i.qty, 0);
    if (!total) throw new HttpError(400, 'Pick at least one pass.');
    if (total > maxQty) throw new HttpError(400, `You can book up to ${maxQty} passes in one order.`);
    return items.sort((a, b) => passRank.get(a.pass.id) - passRank.get(b.pass.id));
  }

  // ── inventory ─────────────────────────────────────────────────────────────
  // A pass is "taken" if it is an active ticket on a paid order, or sitting in
  // someone's checkout that has not timed out yet.

  async function availability(q = db) {
    const { rows } = await q.query(`
      SELECT pass_id, SUM(n)::int AS held FROM (
        SELECT t.pass_id, 1 AS n
          FROM tickets t JOIN orders o ON o.id = t.order_id
         WHERE t.status = 'active' AND o.status = 'paid'
        UNION ALL
        SELECT i.pass_id, i.qty AS n
          FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.status = 'pending' AND o.expires_at > now()
      ) x GROUP BY pass_id`);
    const held = Object.fromEntries(rows.map((r) => [r.pass_id, Number(r.held)]));
    const totalHeld = Object.values(held).reduce((a, b) => a + b, 0);
    const totalLeft = event.totalCapacity == null ? null : Math.max(0, event.totalCapacity - totalHeld);
    const passes = {};
    for (const p of event.passes) {
      let remaining = p.capacity == null ? null : Math.max(0, p.capacity - (held[p.id] || 0));
      if (totalLeft != null) remaining = remaining == null ? totalLeft : Math.min(remaining, totalLeft);
      passes[p.id] = remaining;
    }
    return { passes, totalLeft };
  }

  async function publicEvent() {
    const avail = await availability();
    return {
      brand: event.brand,
      event: event.event,
      salesOpen: event.salesOpen,
      maxPerOrder: event.maxPerOrder,
      holdMinutes: event.holdMinutes,
      perks: event.perks,
      paymentMode: cfg.paymentMode,
      passes: event.passes
        .filter((p) => p.active)
        .map((p) => {
          const remaining = avail.passes[p.id];
          return {
            id: p.id,
            audience: p.audience,
            name: p.name,
            emoji: p.emoji,
            price: p.price,
            blurb: p.blurb,
            includes: p.includes,
            soldOut: remaining === 0,
            left: remaining != null && remaining <= SHOW_LEFT_BELOW ? remaining : null,
          };
        }),
    };
  }

  // ── orders ────────────────────────────────────────────────────────────────

  const getOrder = async (id) => (await db.query('SELECT * FROM orders WHERE id = $1', [String(id)])).rows[0] || null;
  const getOrderByToken = async (token) =>
    (await db.query('SELECT * FROM orders WHERE access_token = $1', [String(token)])).rows[0] || null;

  /**
   * Reserves passes and (online) opens a Razorpay order for the exact amount.
   * source: 'online' (customer, pays via Razorpay) | 'door' (cash/UPI at the gate) | 'comp' (free).
   * Door and comp orders are issued immediately.
   */
  async function createOrder(input, { source = 'online', note = '' } = {}) {
    const online = source === 'online';
    if (online && !event.salesOpen) throw new HttpError(403, 'Sales are closed right now.');
    const buyer = validateBuyer(input, { emailRequired: online });
    const items = validateItems(input.items, online ? event.maxPerOrder : 200);
    const unitPrice = (pass) => (source === 'comp' ? 0 : pass.price * 100);
    const amount = items.reduce((s, i) => s + unitPrice(i.pass) * i.qty, 0);
    const id = newOrderId();
    const token = newAccessToken();

    await db.tx(async (q) => {
      await q.query('SELECT pg_advisory_xact_lock($1)', [ORDER_LOCK]);
      const avail = await availability(q);
      for (const { pass, qty } of items) {
        const left = avail.passes[pass.id];
        if (left != null && qty > left) {
          throw new HttpError(409, left ? `Only ${left} × ${pass.name} left.` : `${pass.name} is sold out.`);
        }
      }
      const qty = items.reduce((s, i) => s + i.qty, 0);
      if (avail.totalLeft != null && qty > avail.totalLeft) {
        throw new HttpError(409, avail.totalLeft ? `Only ${avail.totalLeft} passes left in total.` : 'The event is sold out.');
      }
      await q.query(
        `INSERT INTO orders (id, access_token, name, phone, email, amount, source, note, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(mins => $9::int))`,
        [id, token, buyer.name, buyer.phone, buyer.email, amount, source, String(note).slice(0, 200), event.holdMinutes],
      );
      for (const { pass, qty: n } of items) {
        await q.query('INSERT INTO order_items (order_id, pass_id, pass_name, unit_price, qty) VALUES ($1, $2, $3, $4, $5)', [
          id,
          pass.id,
          pass.name,
          unitPrice(pass),
          n,
        ]);
      }
    });

    const result = { id, token, amount, passUrl: passUrl(token), payment: { mode: cfg.paymentMode } };
    if (!online) {
      await fulfill(id);
      return result;
    }
    if (razorpay) {
      try {
        const rz = await razorpay.createOrder({ amount, receipt: id, notes: { booking: id, name: buyer.name, phone: buyer.phone } });
        await db.query('UPDATE orders SET provider_order_id = $2 WHERE id = $1', [id, rz.id]);
        result.payment = { mode: 'razorpay', keyId: razorpay.keyId, orderId: rz.id, timeoutSeconds: event.holdMinutes * 60 };
      } catch (err) {
        console.error('[razorpay] create order failed:', err.message);
        await db.query("UPDATE orders SET status = 'failed' WHERE id = $1", [id]);
        throw new HttpError(502, 'Could not reach the payment gateway. Please try again in a minute.');
      }
    }
    return { ...result, buyer };
  }

  /**
   * Marks an order paid and mints one ticket per pass. Safe to call any number
   * of times from anywhere (browser callback, webhook, admin): the conditional
   * UPDATE means only the first caller issues tickets.
   */
  async function fulfill(orderId, { paymentId = null } = {}) {
    const order = await db.tx(async (q) => {
      const { rows } = await q.query(
        `UPDATE orders SET status = 'paid', paid_at = now(), provider_payment_id = COALESCE($2, provider_payment_id)
          WHERE id = $1 AND status IN ('pending', 'failed') RETURNING *`,
        [orderId, paymentId],
      );
      if (!rows.length) return null;
      const { rows: items } = await q.query('SELECT pass_id, qty FROM order_items WHERE order_id = $1', [orderId]);
      items.sort(byPassRank);
      let seq = 0;
      for (const item of items) {
        for (let i = 0; i < item.qty; i++) {
          seq++;
          // 40-bit random ids basically never collide, but if one does we just roll again.
          for (;;) {
            const ins = await q.query(
              `INSERT INTO tickets (id, order_id, pass_id, holder_name, seq) VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO NOTHING RETURNING id`,
              [newTicketId(), orderId, item.pass_id, rows[0].name, seq],
            );
            if (ins.rows.length) break;
          }
        }
      }
      return rows[0];
    });
    if (order) {
      console.log(`[order] ${order.id} confirmed: ${order.source}, ₹${order.amount / 100}, ${order.name}`);
      if (order.email && mailer) track(sendPassEmail(order.id), `email ${order.id}`);
    }
    return order;
  }

  /** Browser-side success: check Razorpay's signature, then issue tickets. */
  async function verifyCheckout(token, body) {
    if (!razorpay) throw new HttpError(400, 'Payments are in demo mode.');
    const order = await getOrderByToken(token);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status === 'paid') return order;
    if (order.status === 'refunded') throw new HttpError(409, 'This booking was cancelled.');
    const ok =
      body?.razorpay_order_id === order.provider_order_id &&
      razorpay.verifyCheckoutSignature({
        orderId: order.provider_order_id,
        paymentId: body?.razorpay_payment_id,
        signature: body?.razorpay_signature,
      });
    if (!ok) {
      throw new HttpError(
        400,
        `We could not verify that payment. If money was deducted it will confirm automatically within a few minutes, or contact us with booking ID ${order.id}.`,
      );
    }
    await fulfill(order.id, { paymentId: body.razorpay_payment_id });
    ensureCaptured(body.razorpay_payment_id, order.amount);
    return getOrder(order.id);
  }

  /** Belt and braces: if auto-capture is off in the Razorpay dashboard, capture here. */
  function ensureCaptured(paymentId, amount) {
    track(
      razorpay.fetchPayment(paymentId).then((p) => (p.status === 'authorized' ? razorpay.capturePayment(paymentId, amount) : null)),
      'razorpay capture check',
    );
  }

  /** Demo mode only: pretend Razorpay said yes. */
  async function demoPay(token) {
    if (cfg.paymentMode !== 'demo') throw new HttpError(404, 'Not found.');
    const order = await getOrderByToken(token);
    if (!order) throw new HttpError(404, 'Order not found.');
    await fulfill(order.id, { paymentId: 'demo_' + Date.now() });
    return getOrder(order.id);
  }

  /** Asks Razorpay directly whether a pending order was paid (for "I paid but got nothing"). */
  async function reconcile(order) {
    if (!order || order.status !== 'pending' || !razorpay || !order.provider_order_id) return false;
    const payments = await razorpay.fetchOrderPayments(order.provider_order_id);
    let pay = payments.find((p) => p.status === 'captured' && p.amount === order.amount);
    if (!pay) {
      const authorized = payments.find((p) => p.status === 'authorized' && p.amount === order.amount);
      if (authorized) {
        await razorpay.capturePayment(authorized.id, order.amount);
        pay = authorized;
      }
    }
    if (!pay) return false;
    await fulfill(order.id, { paymentId: pay.id });
    return true;
  }

  /** Razorpay server → our server. Works even if the buyer closed the tab right after paying. */
  async function handleWebhook(rawBody, signature) {
    if (!razorpay?.verifyWebhookSignature(rawBody, signature)) throw new HttpError(400, 'Invalid webhook signature.');
    let evt;
    try {
      evt = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new HttpError(400, 'Invalid JSON.');
    }
    if (!['payment.captured', 'order.paid'].includes(evt.event)) return { ignored: evt.event };
    const pay = evt.payload?.payment?.entity;
    const rzOrderId = pay?.order_id || evt.payload?.order?.entity?.id;
    if (!rzOrderId) return { ignored: 'no order id' };
    const order = (await db.query('SELECT * FROM orders WHERE provider_order_id = $1', [rzOrderId])).rows[0];
    if (!order) return { ignored: 'unknown order' };
    if (pay && pay.amount !== order.amount) {
      console.error(`[webhook] amount mismatch on ${order.id}: paid ${pay.amount}, expected ${order.amount}`);
      return { ignored: 'amount mismatch' };
    }
    if (order.status === 'refunded') {
      console.warn(`[webhook] payment arrived for cancelled order ${order.id}; refund it from the Razorpay dashboard`);
      return { ignored: 'order cancelled' };
    }
    await fulfill(order.id, { paymentId: pay?.id || null });
    return { ok: true };
  }

  // ── passes ────────────────────────────────────────────────────────────────

  async function ticketsWithUse(orderIds) {
    const { rows } = await db.query(
      `SELECT t.*,
              COALESCE(json_object_agg(r.kind, json_build_object('at', r.at, 'gate', r.gate))
                       FILTER (WHERE r.kind IS NOT NULL), '{}') AS used
         FROM tickets t LEFT JOIN redemptions r ON r.ticket_id = t.id
        WHERE t.order_id = ANY($1)
        GROUP BY t.id
        ORDER BY t.order_id, t.seq`,
      [orderIds],
    );
    return rows;
  }

  async function ticketView(t, of) {
    const pass = passInfo(t.pass_id);
    const code = ticketCode(secrets.ticket, t.id);
    return {
      id: formatTicketId(t.id),
      code,
      holder: t.holder_name,
      seq: t.seq,
      of,
      status: t.status,
      used: t.used || {},
      pass: { id: pass.id, name: pass.name, emoji: pass.emoji, audience: pass.audience, includes: pass.includes, redeem: pass.redeem },
      qrSvg: await QRCode.toString(qrPayload(secrets.ticket, t.id), { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }),
      shareUrl: `${cfg.publicUrl}/t/${code}`,
    };
  }

  async function orderItems(orderId) {
    const { rows } = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    return rows.sort(byPassRank).map((i) => ({ passId: i.pass_id, name: i.pass_name, qty: i.qty, unitPrice: i.unit_price }));
  }

  const orderSummary = (o, items) => ({
    id: o.id,
    name: o.name,
    status: o.status,
    source: o.source,
    amount: o.amount,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    expiresAt: o.expires_at,
    items,
    attendees: items.reduce((s, i) => s + i.qty, 0),
  });

  /** Everything the buyer's pass page shows. Never includes phone/email. */
  async function passView(token) {
    const order = await getOrderByToken(token);
    if (!order) return null;
    const items = await orderItems(order.id);
    const rows = ['paid', 'refunded'].includes(order.status) ? await ticketsWithUse([order.id]) : [];
    return {
      order: orderSummary(order, items),
      tickets: await Promise.all(rows.map((t) => ticketView(t, rows.length))),
      event: { brand: event.brand, ...event.event, perks: event.perks },
    };
  }

  /** A single pass opened from its share link /t/ID.SIG (what you forward to a friend). */
  async function singleTicketView(code) {
    const parsed = parseScan(code);
    if (!parsed?.sig || !verifyTicketSig(secrets.ticket, parsed.id, parsed.sig)) return null;
    const t = (await db.query('SELECT order_id FROM tickets WHERE id = $1', [parsed.id])).rows[0];
    if (!t) return null;
    const order = await getOrder(t.order_id);
    const rows = await ticketsWithUse([order.id]);
    const mine = rows.find((r) => r.id === parsed.id);
    return {
      single: true,
      order: { id: order.id, name: order.name, status: order.status },
      tickets: [await ticketView(mine, rows.length)],
      event: { brand: event.brand, ...event.event, perks: event.perks },
    };
  }

  async function refreshPass(token) {
    const order = await getOrderByToken(token);
    if (!order) throw new HttpError(404, 'Order not found.');
    try {
      await reconcile(order);
    } catch (err) {
      console.error('[reconcile]', err.message);
    }
    return passView(token);
  }

  // ── gate scanning ─────────────────────────────────────────────────────────

  async function scan({ raw, kind = 'entry', gate = '' }) {
    gate = String(gate || '').slice(0, 40);
    if (!scanKinds.includes(kind)) throw new HttpError(400, 'Unknown scan mode.');
    const log = (result, ticketId, detail = '') =>
      db
        .query('INSERT INTO scan_log (ticket_id, kind, result, gate, detail) VALUES ($1, $2, $3, $4, $5)', [
          ticketId,
          kind,
          result,
          gate,
          detail,
        ])
        .catch((err) => console.error('[scan_log]', err.message));

    const parsed = parseScan(raw);
    if (!parsed) {
      await log('invalid', null, 'unreadable: ' + String(raw || '').slice(0, 60));
      return { result: 'invalid', reason: 'Not a DELULU pass' };
    }
    if (parsed.sig && !verifyTicketSig(secrets.ticket, parsed.id, parsed.sig)) {
      await log('invalid', parsed.id, 'bad signature');
      return { result: 'invalid', reason: 'Fake or edited QR code' };
    }

    const { rows } = await db.query(
      `SELECT t.*, o.status AS order_status,
              (SELECT count(*)::int FROM tickets x WHERE x.order_id = t.order_id) AS of
         FROM tickets t JOIN orders o ON o.id = t.order_id
        WHERE t.id = $1`,
      [parsed.id],
    );
    const t = rows[0];
    if (!t) {
      await log('invalid', parsed.id, 'not found');
      return { result: 'invalid', reason: 'No such ticket' };
    }
    const pass = passInfo(t.pass_id);
    const ticket = {
      id: formatTicketId(t.id),
      holder: t.holder_name,
      seq: t.seq,
      of: t.of,
      booking: t.order_id,
      pass: { id: pass.id, name: pass.name, emoji: pass.emoji, audience: pass.audience, includes: pass.includes },
    };
    if (t.status !== 'active' || t.order_status !== 'paid') {
      await log('invalid', t.id, 'cancelled');
      return { result: 'invalid', reason: 'This pass was cancelled / refunded', ticket };
    }
    if (kind !== 'entry' && !pass.redeem.includes(kind)) {
      await log('not_included', t.id);
      return { result: 'not_included', reason: `${perkLabel(kind)} is not included in this pass`, ticket };
    }

    // The primary key on (ticket_id, kind) makes this atomic: exactly one scan wins.
    const ins = await db.query(
      'INSERT INTO redemptions (ticket_id, kind, gate) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING at',
      [t.id, kind, gate],
    );
    if (ins.rows.length) {
      await log('valid', t.id);
      return { result: 'valid', ticket, at: ins.rows[0].at };
    }
    const first = (await db.query('SELECT at, gate FROM redemptions WHERE ticket_id = $1 AND kind = $2', [t.id, kind])).rows[0];
    await log('used', t.id);
    return {
      result: 'used',
      reason: kind === 'entry' ? 'This pass has already been used to enter' : `${perkLabel(kind)} already collected`,
      ticket,
      first: first || null,
    };
  }

  /** Staff can undo a scan from the last few minutes (e.g. student with no ID was turned away). */
  async function undoRedemption({ ticketId, kind = 'entry', maxAgeMinutes = null, gate = '' }) {
    const parsed = parseScan(ticketId);
    if (!parsed) throw new HttpError(400, 'Invalid ticket.');
    const { rows } = await db.query(
      `DELETE FROM redemptions
        WHERE ticket_id = $1 AND kind = $2
          AND ($3::int IS NULL OR at > now() - make_interval(mins => $3::int))
        RETURNING ticket_id`,
      [parsed.id, kind, maxAgeMinutes],
    );
    if (!rows.length) throw new HttpError(409, 'Nothing to undo (scans older than a few minutes need an admin).');
    await db.query('INSERT INTO scan_log (ticket_id, kind, result, gate) VALUES ($1, $2, $3, $4)', [parsed.id, kind, 'undo', String(gate).slice(0, 40)]);
    return { ok: true };
  }

  async function scanStats() {
    const { rows } = await db.query('SELECT kind, count(*)::int AS n FROM redemptions GROUP BY kind');
    const { rows: total } = await db.query(
      `SELECT count(*)::int AS n FROM tickets t JOIN orders o ON o.id = t.order_id WHERE t.status = 'active' AND o.status = 'paid'`,
    );
    return { redeemed: Object.fromEntries(rows.map((r) => [r.kind, Number(r.n)])), tickets: Number(total[0].n) };
  }

  // ── admin ─────────────────────────────────────────────────────────────────

  async function adminSummary() {
    const { rows: perPass } = await db.query(`
      SELECT t.pass_id, count(*)::int AS sold, SUM(i.unit_price)::bigint AS revenue, count(r.ticket_id)::int AS checked_in
        FROM tickets t
        JOIN orders o ON o.id = t.order_id
        JOIN order_items i ON i.order_id = t.order_id AND i.pass_id = t.pass_id
        LEFT JOIN redemptions r ON r.ticket_id = t.id AND r.kind = 'entry'
       WHERE t.status = 'active' AND o.status = 'paid'
       GROUP BY t.pass_id`);
    const { rows: perSource } = await db.query(`
      SELECT o.source, count(DISTINCT o.id)::int AS orders, count(*)::int AS tickets, SUM(i.unit_price)::bigint AS revenue
        FROM tickets t
        JOIN orders o ON o.id = t.order_id
        JOIN order_items i ON i.order_id = t.order_id AND i.pass_id = t.pass_id
       WHERE t.status = 'active' AND o.status = 'paid'
       GROUP BY o.source`);
    const { rows: pending } = await db.query(
      `SELECT count(*)::int AS n FROM orders WHERE status = 'pending' AND expires_at > now()`,
    );
    const stats = await scanStats();
    const byPass = Object.fromEntries(perPass.map((r) => [r.pass_id, r]));
    const passes = event.passes.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      price: p.price,
      capacity: p.capacity,
      redeem: p.redeem,
      sold: Number(byPass[p.id]?.sold || 0),
      revenue: Number(byPass[p.id]?.revenue || 0),
      checkedIn: Number(byPass[p.id]?.checked_in || 0),
    }));
    const sources = Object.fromEntries(
      perSource.map((r) => [r.source, { orders: Number(r.orders), tickets: Number(r.tickets), revenue: Number(r.revenue) }]),
    );
    return {
      paymentMode: cfg.paymentMode,
      emailEnabled: Boolean(mailer),
      passes,
      sources,
      totals: {
        sold: passes.reduce((s, p) => s + p.sold, 0),
        revenue: passes.reduce((s, p) => s + p.revenue, 0),
        checkedIn: stats.redeemed.entry || 0,
        orders: Object.values(sources).reduce((s, x) => s + x.orders, 0),
        pendingCheckouts: Number(pending[0].n),
        capacity: event.totalCapacity,
      },
      redeemed: stats.redeemed,
      perks: event.perks,
      passOptions: event.passes.map((p) => ({ id: p.id, name: p.name, price: p.price, emoji: p.emoji })),
    };
  }

  async function adminOrders({ q = '', status = '', limit = 100 } = {}) {
    const term = String(q).trim();
    const like = '%' + term.replace(/[%_\\]/g, '\\$&') + '%';
    const digits = term.replace(/\D/g, '');
    const ticketId = parseScan(term)?.id || '';
    const { rows: orders } = await db.query(
      `SELECT o.* FROM orders o
        WHERE ($1 = '' OR o.name ILIKE $2 OR o.email ILIKE $2 OR o.id ILIKE $2
               OR ($3 <> '' AND o.phone LIKE '%' || $3 || '%')
               OR EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id AND t.id = $4))
          AND ($5 = '' OR o.status = $5)
        ORDER BY o.created_at DESC
        LIMIT $6`,
      [term, like, digits.length >= 4 ? digits : '', ticketId, String(status), Math.min(Number(limit) || 100, 500)],
    );
    const ids = orders.map((o) => o.id);
    const tickets = ids.length ? await ticketsWithUse(ids) : [];
    const { rows: items } = ids.length ? await db.query('SELECT * FROM order_items WHERE order_id = ANY($1)', [ids]) : { rows: [] };
    return orders.map((o) => ({
      ...orderSummary(
        o,
        items
          .filter((i) => i.order_id === o.id)
          .sort(byPassRank)
          .map((i) => ({ passId: i.pass_id, name: i.pass_name, qty: i.qty, unitPrice: i.unit_price })),
      ),
      phone: o.phone,
      email: o.email,
      note: o.note,
      paymentId: o.provider_payment_id,
      emailSentAt: o.email_sent_at,
      abandoned: o.status === 'pending' && new Date(o.expires_at) < new Date(),
      passUrl: passUrl(o.access_token),
      tickets: tickets
        .filter((t) => t.order_id === o.id)
        .map((t) => ({ id: formatTicketId(t.id), passName: passInfo(t.pass_id).name, status: t.status, used: t.used || {} })),
    }));
  }

  async function cancelOrder(orderId) {
    return db.tx(async (q) => {
      const { rows } = await q.query(
        `UPDATE orders SET status = CASE WHEN status = 'paid' THEN 'refunded' ELSE 'failed' END
          WHERE id = $1 AND status IN ('paid', 'pending') RETURNING status`,
        [orderId],
      );
      if (!rows.length) throw new HttpError(409, 'Only paid or pending orders can be cancelled.');
      await q.query("UPDATE tickets SET status = 'void' WHERE order_id = $1", [orderId]);
      return { status: rows[0].status };
    });
  }

  async function setTicketStatus(ticketId, status) {
    const parsed = parseScan(ticketId);
    if (!parsed) throw new HttpError(400, 'Invalid ticket id.');
    const { rows } = await db.query('UPDATE tickets SET status = $2 WHERE id = $1 RETURNING id', [parsed.id, status]);
    if (!rows.length) throw new HttpError(404, 'Ticket not found.');
    return { ok: true };
  }

  async function adminReconcile(orderId) {
    const order = await getOrder(orderId);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status !== 'pending') return { status: order.status, changed: false };
    const changed = await reconcile(order);
    return { status: changed ? 'paid' : 'pending', changed };
  }

  async function recentScans(limit = 50) {
    const { rows } = await db.query(
      `SELECT s.*, t.holder_name, t.pass_id FROM scan_log s LEFT JOIN tickets t ON t.id = s.ticket_id
        ORDER BY s.at DESC LIMIT $1`,
      [Math.min(Number(limit) || 50, 500)],
    );
    return rows.map((s) => ({
      at: s.at,
      kind: s.kind,
      result: s.result,
      gate: s.gate,
      detail: s.detail,
      ticket: s.ticket_id ? formatTicketId(s.ticket_id) : null,
      holder: s.holder_name,
      passName: s.pass_id ? passInfo(s.pass_id).name : null,
    }));
  }

  async function exportCsv() {
    const { rows } = await db.query(`
      SELECT t.id, t.seq, t.status AS ticket_status, t.pass_id, t.holder_name,
             o.id AS booking, o.phone, o.email, o.source, o.status AS order_status, o.paid_at, o.provider_payment_id,
             i.unit_price,
             COALESCE((SELECT json_object_agg(r.kind, r.at) FROM redemptions r WHERE r.ticket_id = t.id), '{}') AS used
        FROM tickets t
        JOIN orders o ON o.id = t.order_id
        JOIN order_items i ON i.order_id = t.order_id AND i.pass_id = t.pass_id
       ORDER BY o.paid_at, o.id, t.seq`);
    const ist = (d) =>
      d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '';
    const perkKeys = Object.keys(event.perks);
    const header = [
      'Ticket', 'Booking', 'Pass', 'Name', 'Phone', 'Email', 'Source', 'Price (₹)', 'Order status', 'Ticket status',
      'Paid at (IST)', 'Payment ID', 'Checked in (IST)', ...perkKeys.map((k) => `${event.perks[k].label} (IST)`),
    ];
    const lines = rows.map((r) => [
      formatTicketId(r.id), r.booking, passInfo(r.pass_id).name, r.holder_name, r.phone, r.email, r.source,
      r.unit_price / 100, r.order_status, r.ticket_status, ist(r.paid_at), r.provider_payment_id || '',
      ist(r.used?.entry), ...perkKeys.map((k) => ist(r.used?.[k])),
    ]);
    return '﻿' + [header, ...lines].map((cols) => cols.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // ── email ─────────────────────────────────────────────────────────────────

  async function sendPassEmail(orderId) {
    if (!mailer) throw new HttpError(400, 'Email is not set up (add SMTP_* settings).');
    const order = await getOrder(orderId);
    if (!order || order.status !== 'paid') throw new HttpError(409, 'Only confirmed orders can be emailed.');
    if (!order.email) throw new HttpError(400, 'This order has no email address.');
    const { rows: tickets } = await db.query('SELECT * FROM tickets WHERE order_id = $1 AND status = $2 ORDER BY seq', [orderId, 'active']);
    const withQr = await Promise.all(
      tickets.map(async (t) => ({
        id: formatTicketId(t.id),
        cid: `qr-${t.id}@delulu`,
        seq: t.seq,
        pass: passInfo(t.pass_id),
        png: await QRCode.toBuffer(qrPayload(secrets.ticket, t.id), { width: 360, margin: 1, errorCorrectionLevel: 'M' }),
      })),
    );
    const { subject, html, text } = passEmail({ brand: event.brand, event: event.event, order, tickets: withQr, passUrl: passUrl(order.access_token) });
    await mailer.send({
      to: order.email,
      subject,
      html,
      text,
      attachments: withQr.map((t) => ({ filename: `${t.id}.png`, content: t.png, cid: t.cid })),
    });
    await db.query('UPDATE orders SET email_sent_at = now() WHERE id = $1', [orderId]);
    console.log(`[email] passes for ${orderId} sent to ${order.email}`);
    return { ok: true };
  }

  return {
    drain,
    publicEvent,
    createOrder,
    fulfill,
    verifyCheckout,
    demoPay,
    handleWebhook,
    passView,
    singleTicketView,
    refreshPass,
    scan,
    undoRedemption,
    scanStats,
    adminSummary,
    adminOrders,
    cancelOrder,
    setTicketStatus,
    adminReconcile,
    recentScans,
    exportCsv,
    sendPassEmail,
    getOrder,
  };
}

/** CSV cell, also defusing spreadsheet formulas (a name like "=HYPERLINK(...)" stays text). */
function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
