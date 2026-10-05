// Netlify Function: runs the same Express app as `npm start`, once per warm instance.
// netlify.toml rewrites /api/* here; the HTML/CSS/JS pages are served straight from public/.
import serverless from 'serverless-http';
import { createApp } from '../../src/app.js';

let ready = null;

function boot() {
  ready ??= createApp({ serverless: true }).then((ctx) => ({ ctx, handle: serverless(ctx.app) }));
  ready.catch(() => (ready = null)); // retry setup on the next request instead of caching the failure
  return ready;
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let app;
  try {
    app = await boot();
  } catch (err) {
    // Usually a missing setting (DATABASE_URL, ADMIN_PASSWORD…). Names only, never values.
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ error: `Site setup problem. ${err.message}` }),
    };
  }
  const response = await app.handle(event, context);
  await app.ctx.service.drain(); // let confirmation emails finish before Netlify freezes us
  return response;
};
