import path from 'node:path';
import express from 'express';
import { ROOT, buildConfig, validateEvent } from './config.js';
import { openDb, migrate, getOrCreateSecret } from './db.js';
import { newSecret } from './codes.js';
import { createRazorpay } from './razorpay.js';
import { createMailer } from './mailer.js';
import { clientKey, createAuth, rateLimiter } from './auth.js';
import { createService, HttpError } from './service.js';

const PUBLIC = path.join(ROOT, 'public');
const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC, file));

/**
 * Builds the whole ticketing app. Tests pass `env` / `eventConfig` / `dataDir`
 * to run isolated copies; server.js calls it with the defaults; the Netlify
 * function passes `serverless: true`.
 */
export async function createApp({ env = process.env, eventConfig, dataDir, serverless = false } = {}) {
  const cfg = buildConfig(env, { serverless });
  if (dataDir) cfg.dataDir = dataDir;
  const event = validateEvent(eventConfig ?? (await import('../event.config.js')).default);

  const db = await openDb(cfg);
  await migrate(db);
  const secrets = {
    ticket: await getOrCreateSecret(db, 'ticket_secret', newSecret),
    session: await getOrCreateSecret(db, 'session_secret', newSecret),
  };
  const razorpay = cfg.paymentMode === 'razorpay' ? createRazorpay(cfg.razorpay) : null;
  const mailer = createMailer(cfg);
  const service = createService({ db, cfg, event, razorpay, mailer, secrets });
  const auth = createAuth({
    secret: secrets.session,
    adminPassword: cfg.adminPassword,
    scannerPin: cfg.scannerPin,
    secureCookies: cfg.publicUrl.startsWith('https://'),
  });

  // Per-client limits. Generous on purpose: a whole college shares one Wi-Fi IP.
  const limits = {
    order: rateLimiter(60, 10 * 60e3),
    refresh: rateLimiter(120, 5 * 60e3),
    loginFail: rateLimiter(10, 15 * 60e3),
    // Across everyone: caps how fast anyone can guess the scanner PIN, however many IPs they use.
    loginFailAll: rateLimiter(100, 15 * 60e3),
  };
  const limit = (bucket, key, message = 'Too many attempts. Please wait a few minutes.') => {
    if (!limits[bucket](key)) throw new HttpError(429, message);
  };

  const app = express();
  app.disable('x-powered-by');
  // On Netlify, /api/* is rewritten to /.netlify/functions/api/*; map it back.
  app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) req.url = '/api' + req.url.slice('/.netlify/functions/api'.length);
    next();
  });
  if (cfg.trustProxy) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    // Pass links carry secrets in the URL; never leak them to other sites via Referer.
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' });
    next();
  });

  // Razorpay webhook needs the raw bytes to check the signature, so it goes before express.json().
  app.post('/api/webhooks/razorpay', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
    if (!razorpay) throw new HttpError(404, 'Payments are in demo mode.');
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    res.json(await service.handleWebhook(body, req.get('x-razorpay-signature')));
  });

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '32kb' }));

  // ── public ────────────────────────────────────────────────────────────────
  app.get('/api/event', async (req, res) => res.json(await service.publicEvent()));

  app.post('/api/orders', async (req, res) => {
    limit('order', clientKey(req));
    res.status(201).json(await service.createOrder(req.body || {}));
  });

  app.post('/api/orders/:token/verify', async (req, res) => {
    const order = await service.verifyCheckout(req.params.token, req.body);
    res.json({ status: order.status, passUrl: `/p/${req.params.token}` });
  });

  app.post('/api/orders/:token/demo-pay', async (req, res) => {
    const order = await service.demoPay(req.params.token);
    res.json({ status: order.status, passUrl: `/p/${req.params.token}` });
  });

  app.get('/api/pass/:token', async (req, res) => {
    const view = await service.passView(req.params.token);
    if (!view) throw new HttpError(404, 'We could not find that booking.');
    res.json(view);
  });

  app.post('/api/pass/:token/refresh', async (req, res) => {
    limit('refresh', clientKey(req));
    res.json(await service.refreshPass(req.params.token));
  });

  app.get('/api/ticket/:code', async (req, res) => {
    const view = await service.singleTicketView(req.params.code);
    if (!view) throw new HttpError(404, 'We could not find that pass.');
    res.json(view);
  });

  // ── staff / admin login ───────────────────────────────────────────────────
  app.post('/api/auth/login', async (req, res) => {
    const who = clientKey(req);
    if (limits.loginFail.blocked(who) || limits.loginFailAll.blocked('all')) {
      throw new HttpError(429, 'Too many wrong attempts. Wait 15 minutes and try again.');
    }
    const { role, password, gate } = req.body || {};
    const session = auth.login(res, { role, secret: password, gate });
    if (!session) {
      limits.loginFail(who);
      limits.loginFailAll('all');
      throw new HttpError(401, role === 'admin' ? 'Wrong password.' : 'Wrong PIN.');
    }
    res.json({ role: session.role, gate: session.gate });
  });
  app.post('/api/auth/logout', (req, res) => {
    auth.logout(res);
    res.json({ ok: true });
  });
  app.get('/api/auth/me', (req, res) => {
    const s = auth.read(req);
    res.json(s ? { role: s.role, gate: s.gate } : { role: null });
  });

  // ── gate scanner (staff PIN) ──────────────────────────────────────────────
  const staff = auth.require('staff');
  app.post('/api/scan', staff, async (req, res) => {
    const { code, kind, gate } = req.body || {};
    res.json(await service.scan({ raw: code, kind, gate: gate || req.session.gate }));
  });
  app.post('/api/scan/undo', staff, async (req, res) => {
    const { ticketId, kind, gate } = req.body || {};
    const maxAgeMinutes = req.session.role === 'admin' ? null : 5;
    res.json(await service.undoRedemption({ ticketId, kind, maxAgeMinutes, gate: gate || req.session.gate }));
  });
  app.get('/api/scan/stats', staff, async (req, res) => res.json(await service.scanStats()));

  // ── admin dashboard (admin password) ──────────────────────────────────────
  const admin = auth.require('admin');
  app.get('/api/admin/summary', admin, async (req, res) => res.json(await service.adminSummary()));
  app.get('/api/admin/orders', admin, async (req, res) => res.json(await service.adminOrders(req.query)));
  app.post('/api/admin/orders', admin, async (req, res) => {
    const { source = 'door', note = '', ...input } = req.body || {};
    if (!['door', 'comp'].includes(source)) throw new HttpError(400, "source must be 'door' or 'comp'.");
    res.status(201).json(await service.createOrder(input, { source, note }));
  });
  app.post('/api/admin/orders/:id/cancel', admin, async (req, res) => res.json(await service.cancelOrder(req.params.id)));
  app.post('/api/admin/orders/:id/reconcile', admin, async (req, res) => res.json(await service.adminReconcile(req.params.id)));
  app.post('/api/admin/orders/:id/resend', admin, async (req, res) => res.json(await service.sendPassEmail(req.params.id)));
  app.post('/api/admin/tickets/:id/void', admin, async (req, res) => res.json(await service.setTicketStatus(req.params.id, 'void')));
  app.post('/api/admin/tickets/:id/restore', admin, async (req, res) => res.json(await service.setTicketStatus(req.params.id, 'active')));
  app.post('/api/admin/redemptions/undo', admin, async (req, res) => {
    const { ticketId, kind } = req.body || {};
    res.json(await service.undoRedemption({ ticketId, kind, gate: 'admin' }));
  });
  app.get('/api/admin/scans', admin, async (req, res) => res.json(await service.recentScans(req.query.limit)));
  app.get('/api/admin/export.csv', admin, async (req, res) => {
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="delulu-tickets-${stamp}.csv"` });
    res.send(await service.exportCsv());
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // ── pages ─────────────────────────────────────────────────────────────────
  app.get('/p/:token', page('pass.html'));
  app.get('/t/:code', page('pass.html'));
  app.get('/scan', page('scan.html'));
  app.get('/admin', page('admin.html'));
  app.get('/policies', page('policies.html'));
  app.use(express.static(PUBLIC, { index: 'index.html' }));
  app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, '404.html')));

  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const expose = err.expose || status < 500;
    if (!expose) console.error(`[error] ${req.method} ${req.path}`, err);
    if (res.headersSent) return next(err);
    res.status(status).json({ error: expose ? err.message : 'Something went wrong. Please try again.' });
  });

  return { app, cfg, db, service, event, close: () => db.close() };
}
