import { loadDotEnv } from './config.js';

loadDotEnv();
const { createApp } = await import('./app.js');

let ctx;
try {
  ctx = await createApp();
} catch (err) {
  console.error('\n' + err.message + '\n');
  process.exit(1);
}
const { app, cfg, db, event, close } = ctx;

const server = app.listen(cfg.port, () => {
  const line = '─'.repeat(60);
  console.log(`\n${line}\n  ${event.brand} · ${event.event.name}: ticketing is live\n${line}`);
  console.log(`  Website      ${cfg.publicUrl}/`);
  console.log(`  Gate scanner ${cfg.publicUrl}/scan`);
  console.log(`  Admin        ${cfg.publicUrl}/admin`);
  console.log(`  Database     ${db.kind === 'postgres' ? 'Postgres (DATABASE_URL)' : `built-in (${cfg.dataDir})`}`);
  console.log(`  Payments     ${cfg.paymentMode === 'razorpay' ? 'Razorpay' : 'DEMO MODE: no real money moves'}`);
  console.log(`  Email        ${cfg.smtp ? cfg.smtp.host : 'off (passes are shown on screen only)'}`);
  if (!cfg.isProd) console.log(`  Dev logins   admin password "${cfg.adminPassword}", scanner PIN "${cfg.scannerPin}"`);
  console.log(line + '\n');
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`\n${signal} received, shutting down…`);
  server.close();
  await close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
