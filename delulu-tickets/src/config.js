import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Loads `.env` from the project root if there is one. Real env vars win. */
export function loadDotEnv() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/** Checks event.config.js and normalises it. Throws with a readable message on mistakes. */
export function validateEvent(raw) {
  const problems = [];
  const perks = raw.perks || {};
  const seen = new Set();
  const passes = (raw.passes || []).map((p, i) => {
    const where = `passes[${i}] (${p.id || 'no id'})`;
    if (!p.id || !/^[a-z0-9-]{1,32}$/.test(p.id)) problems.push(`${where}: id must be lowercase letters, digits or dashes`);
    if (seen.has(p.id)) problems.push(`${where}: duplicate id`);
    seen.add(p.id);
    if (!p.name) problems.push(`${where}: name is required`);
    if (!Number.isInteger(p.price) || p.price <= 0) problems.push(`${where}: price must be a whole number of rupees`);
    if (!['student', 'all'].includes(p.audience)) problems.push(`${where}: audience must be 'student' or 'all'`);
    if (p.capacity != null && (!Number.isInteger(p.capacity) || p.capacity < 0)) problems.push(`${where}: capacity must be a whole number or null`);
    for (const k of p.redeem || []) if (!perks[k]) problems.push(`${where}: redeem '${k}' is not listed under perks`);
    return {
      id: p.id,
      audience: p.audience,
      name: p.name,
      emoji: p.emoji || '🎟️',
      price: p.price,
      blurb: p.blurb || '',
      includes: p.includes || ['Entry'],
      redeem: p.redeem || [],
      capacity: p.capacity ?? null,
      active: p.active !== false,
    };
  });
  if (!passes.length) problems.push('add at least one pass');
  for (const k of Object.keys(perks)) if (k === 'entry' || !/^[a-z0-9-]{1,32}$/.test(k)) problems.push(`perks: '${k}' is not a valid perk key`);
  if (problems.length) throw new Error('event.config.js has problems:\n  - ' + problems.join('\n  - '));

  return {
    brand: raw.brand || 'DELULU PRODUCTION',
    event: { ...raw.event },
    salesOpen: raw.salesOpen !== false,
    maxPerOrder: raw.maxPerOrder || 10,
    holdMinutes: raw.holdMinutes || 15,
    totalCapacity: raw.totalCapacity ?? null,
    perks,
    passes,
  };
}

/** Reads settings from environment variables. Refuses unsafe production setups. */
export function buildConfig(env = process.env, { serverless = false } = {}) {
  const isProd = env.NODE_ENV === 'production' || serverless;
  const port = Number(env.PORT) || 3000;
  const hasRazorpay = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

  const cfg = {
    isProd,
    port,
    serverless,
    // Netlify sets URL to the site's address automatically.
    publicUrl: (env.PUBLIC_URL || env.URL || `http://localhost:${port}`).replace(/\/+$/, ''),
    databaseUrl: env.DATABASE_URL || null,
    databaseSsl: env.DATABASE_SSL || null, // 'disable' | 'require' | null (auto)
    dataDir: env.DATA_DIR || path.join(ROOT, 'data', 'db'),
    trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY !== '0' : isProd,
    adminPassword: env.ADMIN_PASSWORD || (isProd ? null : 'admin123'),
    scannerPin: env.SCANNER_PIN || (isProd ? null : '1234'),
    paymentMode: hasRazorpay ? 'razorpay' : 'demo',
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID || null,
      keySecret: env.RAZORPAY_KEY_SECRET || null,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || null,
      apiBase: (env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1').replace(/\/+$/, ''),
    },
    smtp: env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT) || 587,
          user: env.SMTP_USER || '',
          pass: env.SMTP_PASS || '',
        }
      : null,
    mailFrom: env.MAIL_FROM || env.SMTP_USER || 'tickets@example.com',
  };

  if (isProd) {
    const problems = [];
    if (!cfg.adminPassword || cfg.adminPassword.length < 10) problems.push('ADMIN_PASSWORD must be set (10+ characters)');
    if (!cfg.scannerPin || cfg.scannerPin.length < 6) problems.push('SCANNER_PIN must be set (6+ digits)');
    if (!env.PUBLIC_URL && !env.URL) problems.push('PUBLIC_URL must be set to your site address, e.g. https://tickets.example.com');
    if (serverless && !cfg.databaseUrl) {
      problems.push('DATABASE_URL must be set: Netlify keeps no files between requests, so use hosted Postgres (e.g. Supabase)');
    }
    if (!hasRazorpay && env.DEMO_MODE !== '1') {
      problems.push('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set (or DEMO_MODE=1 to allow fake payments, never for a real sale)');
    }
    if (problems.length) throw new Error('Refusing to start in production:\n  - ' + problems.join('\n  - '));
  }
  return cfg;
}
