import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, startFakeRazorpay, hmac, TEST_EVENT } from './helpers.js';
import { parseScan } from '../src/codes.js';

const buyer = { name: 'Aarav Sharma', phone: '98765 43210', email: 'aarav@example.com' };

describe('demo mode: buy → pass → scan', () => {
  let ctx, pub, staff, admin;
  before(async () => {
    ctx = await startApp();
    pub = ctx.client();
    staff = ctx.client();
    admin = ctx.client();
  });
  after(() => ctx.stop());

  test('event endpoint lists passes with rupee prices', async () => {
    const { status, data } = await pub.get('/api/event');
    assert.equal(status, 200);
    assert.equal(data.paymentMode, 'demo');
    assert.deepEqual(
      data.passes.map((p) => [p.id, p.price, p.audience]),
      [
        ['student', 299, 'student'],
        ['student-food', 449, 'student'],
        ['general', 399, 'all'],
        ['vip', 649, 'all'],
      ],
    );
    assert.equal(data.passes.find((p) => p.id === 'vip').left, 5, 'low stock is shown');
    assert.equal(data.passes.find((p) => p.id === 'general').left, null, 'unlimited stock is not');
  });

  test('order validation rejects bad input', async () => {
    const bad = [
      [{ ...buyer, phone: '12345' }, /mobile number/],
      [{ ...buyer, email: 'nope' }, /email/],
      [{ ...buyer, name: 'A' }, /name/],
      [{ ...buyer, items: [] }, /at least one/],
      [{ ...buyer, items: [{ passId: 'nope', qty: 1 }] }, /not on sale/],
      [{ ...buyer, items: [{ passId: 'general', qty: 11 }] }, /up to 10/],
      [{ ...buyer, items: [{ passId: 'general', qty: 1.5 }] }, /Invalid quantity/],
    ];
    for (const [body, msg] of bad) {
      const r = await pub.post('/api/orders', { items: [{ passId: 'general', qty: 1 }], ...body });
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.match(r.data.error, msg);
    }
  });

  let order, pass;
  test('server computes the price, never the browser', async () => {
    const r = await pub.post('/api/orders', {
      ...buyer,
      amount: 1, // ignored
      items: [
        { passId: 'student', qty: 1 },
        { passId: 'vip', qty: 2 },
      ],
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.amount, (299 + 2 * 649) * 100);
    assert.equal(r.data.payment.mode, 'demo');
    order = r.data;
  });

  test('pending order has no tickets yet', async () => {
    const r = await pub.get(`/api/pass/${order.token}`);
    assert.equal(r.data.order.status, 'pending');
    assert.equal(r.data.tickets.length, 0);
  });

  test('demo payment issues one ticket per person, and is idempotent', async () => {
    assert.equal((await pub.post(`/api/orders/${order.token}/demo-pay`)).data.status, 'paid');
    assert.equal((await pub.post(`/api/orders/${order.token}/demo-pay`)).data.status, 'paid');
    const r = await pub.get(`/api/pass/${order.token}`);
    assert.equal(r.data.order.status, 'paid');
    assert.equal(r.data.order.attendees, 3);
    assert.equal(r.data.tickets.length, 3);
    assert.deepEqual(r.data.tickets.map((t) => [t.pass.id, t.seq, t.of]), [
      ['student', 1, 3],
      ['vip', 2, 3],
      ['vip', 3, 3],
    ]);
    assert.match(r.data.tickets[0].id, /^DL-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.match(r.data.tickets[0].qrSvg, /^<svg/);
    assert.equal(r.data.order.name, buyer.name);
    assert.ok(!JSON.stringify(r.data).includes(buyer.email), 'pass page never exposes email');
    pass = r.data;
  });

  test('single-pass share link works and rejects forged signatures', async () => {
    const t = pass.tickets[1];
    const ok = await pub.get(`/api/ticket/${t.code}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.data.tickets.length, 1);
    assert.equal(ok.data.tickets[0].id, t.id);
    const forged = t.code.slice(0, -1) + (t.code.endsWith('A') ? 'B' : 'A');
    assert.equal((await pub.get(`/api/ticket/${forged}`)).status, 404);
  });

  test('scanner needs the PIN', async () => {
    assert.equal((await staff.post('/api/scan', { code: 'x' })).status, 401);
    assert.equal((await staff.post('/api/auth/login', { role: 'staff', password: '0000' })).status, 401);
    assert.equal((await staff.post('/api/auth/login', { role: 'admin', password: '4321' })).status, 401, 'PIN is not the admin password');
    assert.equal((await staff.get('/api/auth/me')).data.role, null);
    const r = await staff.post('/api/auth/login', { role: 'staff', password: '4321', gate: 'Gate 1' });
    assert.equal(r.status, 200);
    assert.equal((await staff.get('/api/auth/me')).data.role, 'staff');
    assert.equal((await staff.get('/api/admin/summary')).status, 401, 'staff cannot open admin');
  });

  test('entry scan: VALID, then ALREADY USED', async () => {
    const qr = `DL1.${pass.tickets[0].code}`;
    const first = await staff.post('/api/scan', { code: qr });
    assert.equal(first.data.result, 'valid');
    assert.equal(first.data.ticket.holder, buyer.name);
    assert.equal(first.data.ticket.pass.audience, 'student');
    const again = await staff.post('/api/scan', { code: qr });
    assert.equal(again.data.result, 'used');
    assert.equal(again.data.first.gate, 'Gate 1');
  });

  test('forged / garbage codes are INVALID', async () => {
    const t = pass.tickets[1];
    const [id] = t.code.split('.');
    assert.equal((await staff.post('/api/scan', { code: `DL1.${id}.AAAAAAAA` })).data.result, 'invalid');
    assert.equal((await staff.post('/api/scan', { code: 'DL1.ZZZZZZZZ.AAAAAAAA' })).data.result, 'invalid');
    assert.equal((await staff.post('/api/scan', { code: 'https://example.com' })).data.result, 'invalid');
    assert.equal((await staff.post('/api/scan', { code: 'ZZZZ-ZZZZ' })).data.result, 'invalid', 'unknown typed id');
  });

  test('typed ticket id works (staff only), O/0 and I/1 tolerated', async () => {
    const id = pass.tickets[1].id; // DL-XXXX-XXXX
    const sloppy = id.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i');
    assert.equal(parseScan(sloppy).id, id.replace(/^DL-/, '').replace('-', ''));
    assert.equal((await staff.post('/api/scan', { code: sloppy })).data.result, 'valid');
  });

  test('perk scans: food on student pass is NOT INCLUDED; VIP food once', async () => {
    const student = `DL1.${pass.tickets[0].code}`;
    const vip = `DL1.${pass.tickets[2].code}`;
    assert.equal((await staff.post('/api/scan', { code: student, kind: 'food' })).data.result, 'not_included');
    assert.equal((await staff.post('/api/scan', { code: vip, kind: 'food' })).data.result, 'valid');
    assert.equal((await staff.post('/api/scan', { code: vip, kind: 'food' })).data.result, 'used');
    assert.equal((await staff.post('/api/scan', { code: vip, kind: 'sticks' })).data.result, 'valid');
    assert.equal((await staff.post('/api/scan', { code: vip, kind: 'lol' })).status, 400);
  });

  test('20 phones scanning the same pass at once → exactly one VALID', async () => {
    const vip = `DL1.${pass.tickets[2].code}`;
    const results = await Promise.all(Array.from({ length: 20 }, () => staff.post('/api/scan', { code: vip })));
    const counts = results.reduce((m, r) => ({ ...m, [r.data.result]: (m[r.data.result] || 0) + 1 }), {});
    assert.deepEqual(counts, { valid: 1, used: 19 });
  });

  test('undo a scan (e.g. student turned away for no ID)', async () => {
    const qr = `DL1.${pass.tickets[0].code}`;
    assert.equal((await staff.post('/api/scan/undo', { ticketId: pass.tickets[0].id, kind: 'entry' })).status, 200);
    assert.equal((await staff.post('/api/scan', { code: qr })).data.result, 'valid');
    // Staff cannot undo old scans
    await ctx.db.query("UPDATE redemptions SET at = now() - interval '1 hour'");
    assert.equal((await staff.post('/api/scan/undo', { ticketId: pass.tickets[0].id, kind: 'entry' })).status, 409);
  });

  test('pass page shows check-in status', async () => {
    const r = await pub.get(`/api/pass/${order.token}`);
    assert.ok(r.data.tickets[0].used.entry.at);
    assert.ok(r.data.tickets[2].used.food);
  });

  test('admin: login, summary numbers, search, CSV', async () => {
    assert.equal((await admin.post('/api/auth/login', { role: 'admin', password: 'wrong' })).status, 401);
    assert.equal((await admin.post('/api/auth/login', { role: 'admin', password: 'admin-pass-123' })).status, 200);
    const s = (await admin.get('/api/admin/summary')).data;
    assert.equal(s.totals.sold, 3);
    assert.equal(s.totals.revenue, (299 + 2 * 649) * 100);
    assert.equal(s.totals.checkedIn, 3);
    assert.equal(s.passes.find((p) => p.id === 'vip').sold, 2);
    assert.equal(s.redeemed.food, 1);

    for (const q of ['aarav', '43210', order.id, pass.tickets[1].id]) {
      const r = await admin.get(`/api/admin/orders?q=${encodeURIComponent(q)}`);
      assert.equal(r.data.length, 1, `search ${q}`);
    }
    const found = (await admin.get('/api/admin/orders?status=paid')).data[0];
    assert.equal(found.phone, '9876543210');
    assert.equal(found.tickets.length, 3);
    assert.match(found.passUrl, /\/p\//);

    const csv = await admin.get('/api/admin/export.csv');
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.equal(csv.data.trim().split('\r\n').length, 4);
    assert.match(csv.data, /VIP \+ Food \+ Sticks/);
  });

  test('CSV neutralises spreadsheet formulas in names', async () => {
    const r = await admin.post('/api/admin/orders', { source: 'comp', name: '=HYPERLINK("x")', phone: '9000000001', items: [{ passId: 'general', qty: 1 }] });
    assert.equal(r.status, 201);
    const csv = (await admin.get('/api/admin/export.csv')).data;
    assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  });

  test('door sale + void + cancel', async () => {
    const r = await admin.post('/api/admin/orders', { source: 'door', name: 'Walk In', phone: '9000000002', items: [{ passId: 'general', qty: 2 }] });
    assert.equal(r.status, 201);
    const view = (await pub.get(`/api/pass/${r.data.token}`)).data;
    assert.equal(view.order.status, 'paid');
    assert.equal(view.tickets.length, 2);

    const [a, b] = view.tickets;
    await admin.post(`/api/admin/tickets/${encodeURIComponent(a.id)}/void`);
    assert.equal((await staff.post('/api/scan', { code: `DL1.${a.code}` })).data.result, 'invalid');
    await admin.post(`/api/admin/tickets/${encodeURIComponent(a.id)}/restore`);
    assert.equal((await staff.post('/api/scan', { code: `DL1.${a.code}` })).data.result, 'valid');

    const orderId = view.order.id;
    assert.equal((await admin.post(`/api/admin/orders/${orderId}/cancel`)).data.status, 'refunded');
    const scan = await staff.post('/api/scan', { code: `DL1.${b.code}` });
    assert.equal(scan.data.result, 'invalid');
    assert.match(scan.data.reason, /cancelled/);
    assert.equal((await admin.post(`/api/admin/orders/${orderId}/cancel`)).status, 409);
  });

  test('scan log records every attempt', async () => {
    const log = (await admin.get('/api/admin/scans?limit=500')).data;
    assert.ok(log.length >= 30);
    assert.ok(log.some((l) => l.result === 'undo'));
    assert.ok(log.some((l) => l.result === 'not_included'));
  });
});

describe('inventory', () => {
  let ctx, pub;
  before(async () => {
    ctx = await startApp();
    pub = ctx.client();
  });
  after(() => ctx.stop());

  const vip = (qty, phone = '9811111111') => pub.post('/api/orders', { ...buyer, phone, items: [{ passId: 'vip', qty }] });

  test('unpaid checkouts hold stock; parallel buyers never oversell', async () => {
    // capacity 5; 10 people try to grab 1 each at the same instant
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => vip(1, `98${String(i).padStart(8, '0')}`)));
    assert.equal(results.filter((r) => r.status === 201).length, 5);
    assert.equal(results.filter((r) => r.status === 409).length, 5);
    assert.equal((await pub.get('/api/event')).data.passes.find((p) => p.id === 'vip').soldOut, true);
  });

  test('abandoned checkouts release their passes', async () => {
    await ctx.db.query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE status = 'pending'");
    const r = await vip(2);
    assert.equal(r.status, 201);
    assert.equal((await pub.get('/api/event')).data.passes.find((p) => p.id === 'vip').left, 3);
  });

  test('a late payment for an expired checkout is still honoured', async () => {
    const r = await vip(1);
    await ctx.db.query("UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [r.data.id]);
    assert.equal((await pub.post(`/api/orders/${r.data.token}/demo-pay`)).data.status, 'paid');
  });

  test('sales switch', async () => {
    const closed = await startApp({ eventConfig: { ...TEST_EVENT, salesOpen: false } });
    const r = await closed.client().post('/api/orders', { ...buyer, items: [{ passId: 'general', qty: 1 }] });
    assert.equal(r.status, 403);
    await closed.stop();
  });

  test('overall venue capacity', async () => {
    const capped = await startApp({ eventConfig: { ...TEST_EVENT, totalCapacity: 3 } });
    const c = capped.client();
    assert.equal((await c.post('/api/orders', { ...buyer, items: [{ passId: 'general', qty: 2 }, { passId: 'student', qty: 1 }] })).status, 201);
    const r = await c.post('/api/orders', { ...buyer, items: [{ passId: 'student', qty: 1 }] });
    assert.equal(r.status, 409);
    assert.match(r.data.error, /sold out/);
    await capped.stop();
  });
});

describe('razorpay mode', () => {
  const KEY_SECRET = 'test_key_secret';
  const WEBHOOK_SECRET = 'test_webhook_secret';
  let ctx, rz, pub;
  before(async () => {
    rz = await startFakeRazorpay();
    ctx = await startApp({
      env: {
        RAZORPAY_KEY_ID: 'rzp_test_abc',
        RAZORPAY_KEY_SECRET: KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
        RAZORPAY_API_BASE: rz.apiBase,
      },
    });
    pub = ctx.client();
  });
  after(async () => {
    await ctx.stop();
    await rz.stop();
  });

  const newOrder = async () => {
    const r = await pub.post('/api/orders', { ...buyer, items: [{ passId: 'general', qty: 2 }] });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data;
  };

  test('creates a Razorpay order for the exact amount', async () => {
    const o = await newOrder();
    assert.equal(o.payment.mode, 'razorpay');
    assert.equal(o.payment.keyId, 'rzp_test_abc');
    assert.equal(rz.orders.get(o.payment.orderId).amount, 79800);
    assert.equal(rz.orders.get(o.payment.orderId).receipt, o.id);
    assert.equal(o.payment.timeoutSeconds, 900);
    assert.equal((await pub.post(`/api/orders/${o.token}/demo-pay`)).status, 404, 'demo pay is off');
  });

  test('checkout callback: bad signature rejected, good one issues tickets', async () => {
    const o = await newOrder();
    const paymentId = 'pay_123';
    const bad = await pub.post(`/api/orders/${o.token}/verify`, {
      razorpay_order_id: o.payment.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: hmac('wrong', `${o.payment.orderId}|${paymentId}`),
    });
    assert.equal(bad.status, 400);
    assert.equal((await pub.get(`/api/pass/${o.token}`)).data.tickets.length, 0);

    const good = {
      razorpay_order_id: o.payment.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: hmac(KEY_SECRET, `${o.payment.orderId}|${paymentId}`),
    };
    assert.equal((await pub.post(`/api/orders/${o.token}/verify`, good)).data.status, 'paid');
    assert.equal((await pub.post(`/api/orders/${o.token}/verify`, good)).data.status, 'paid');
    assert.equal((await pub.get(`/api/pass/${o.token}`)).data.tickets.length, 2);
  });

  test("signature for one order can't unlock another", async () => {
    const a = await newOrder();
    const b = await newOrder();
    const r = await pub.post(`/api/orders/${b.token}/verify`, {
      razorpay_order_id: a.payment.orderId,
      razorpay_payment_id: 'pay_x',
      razorpay_signature: hmac(KEY_SECRET, `${a.payment.orderId}|pay_x`),
    });
    assert.equal(r.status, 400);
  });

  test('webhook confirms the order even if the buyer closed the tab', async () => {
    const o = await newOrder();
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_wh', order_id: o.payment.orderId, amount: o.amount, status: 'captured' } } },
    });
    const forged = await pub.post('/api/webhooks/razorpay', body, { 'Content-Type': 'application/json', 'X-Razorpay-Signature': hmac('nope', body) });
    assert.equal(forged.status, 400);

    const headers = { 'Content-Type': 'application/json', 'X-Razorpay-Signature': hmac(WEBHOOK_SECRET, body) };
    assert.equal((await pub.post('/api/webhooks/razorpay', body, headers)).status, 200);
    assert.equal((await pub.post('/api/webhooks/razorpay', body, headers)).status, 200, 'duplicates are fine');
    const view = (await pub.get(`/api/pass/${o.token}`)).data;
    assert.equal(view.order.status, 'paid');
    assert.equal(view.tickets.length, 2, 'no duplicate tickets');
  });

  test('webhook with the wrong amount is ignored', async () => {
    const o = await newOrder();
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_low', order_id: o.payment.orderId, amount: 100, status: 'captured' } } },
    });
    await pub.post('/api/webhooks/razorpay', body, { 'Content-Type': 'application/json', 'X-Razorpay-Signature': hmac(WEBHOOK_SECRET, body) });
    assert.equal((await pub.get(`/api/pass/${o.token}`)).data.order.status, 'pending');
  });

  test('"I paid but got nothing": refresh asks Razorpay and fixes it', async () => {
    const o = await newOrder();
    assert.equal((await pub.post(`/api/pass/${o.token}/refresh`)).data.order.status, 'pending');
    rz.addPayment(o.payment.orderId, { id: 'pay_late', status: 'authorized', amount: o.amount });
    const r = await pub.post(`/api/pass/${o.token}/refresh`);
    assert.equal(r.data.order.status, 'paid');
    assert.equal(r.data.tickets.length, 2);
    assert.ok(rz.calls.includes('POST /v1/payments/pay_late/capture'), 'authorized payment was captured');
  });

  test('gateway down → clear error, stock released', async () => {
    const down = await startApp({ env: { RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's', RAZORPAY_API_BASE: 'http://127.0.0.1:9/v1' } });
    const r = await down.client().post('/api/orders', { ...buyer, items: [{ passId: 'vip', qty: 5 }] });
    assert.equal(r.status, 502);
    const again = await down.client().post('/api/orders', { ...buyer, items: [{ passId: 'vip', qty: 5 }] });
    assert.equal(again.status, 502, 'still 502, not "sold out": failed orders do not hold stock');
    await down.stop();
  });
});

describe('production safety', () => {
  test('refuses to start without real secrets', async () => {
    const { buildConfig } = await import('../src/config.js');
    assert.throws(() => buildConfig({ NODE_ENV: 'production' }), /ADMIN_PASSWORD[\s\S]*SCANNER_PIN[\s\S]*PUBLIC_URL[\s\S]*RAZORPAY/);
    assert.doesNotThrow(() =>
      buildConfig({
        NODE_ENV: 'production',
        ADMIN_PASSWORD: 'a-long-password',
        SCANNER_PIN: '246810',
        PUBLIC_URL: 'https://x.in',
        RAZORPAY_KEY_ID: 'k',
        RAZORPAY_KEY_SECRET: 's',
      }),
    );
  });

  test('bad event config is explained', async () => {
    const { validateEvent } = await import('../src/config.js');
    assert.throws(
      () => validateEvent({ ...TEST_EVENT, passes: [{ id: 'X Y', name: 'x', price: 9.5, audience: 'kids', redeem: ['beer'] }] }),
      /id must be[\s\S]*price[\s\S]*audience[\s\S]*beer/,
    );
  });
});

describe('login brute force', () => {
  test('wrong PINs lock out, even from many IPs, but buyers are unaffected', async () => {
    const ctx = await startApp();
    const c = ctx.client();
    const guess = (ip, pin = '0000') => c.post('/api/auth/login', { role: 'staff', password: pin }, { 'X-Forwarded-For': ip });
    for (let i = 0; i < 10; i++) assert.equal((await guess('10.0.0.1')).status, 401);
    assert.equal((await guess('10.0.0.1')).status, 429, 'same client locked out');
    assert.equal((await guess('10.0.0.1', '4321')).status, 429, 'even the right PIN waits');
    assert.equal((await guess('10.0.0.2', '4321')).status, 200, 'another phone can still log in');
    for (let i = 0; i < 100; i++) await guess(`10.1.${i}.1`);
    assert.equal((await guess('10.9.9.9', '4321')).status, 429, 'global cap stops a distributed guesser');
    assert.equal((await c.get('/api/event')).status, 200);
    await ctx.stop();
  });
});
