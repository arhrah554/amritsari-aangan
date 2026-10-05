import { $, $$, api, brandHtml, esc, istTime, rupees } from './common.js';

const A = { info: null, summary: null, orders: [], searchTimer: null };
const STATUS_LABEL = { paid: 'Paid', pending: 'Pending', abandoned: 'Abandoned', refunded: 'Cancelled', failed: 'Failed' };
const SOURCE_LABEL = { online: 'Online', door: 'Door sale', comp: 'Comp' };

boot();

async function boot() {
  A.info = await api('/api/event').catch(() => null);
  $('#login-brand').innerHTML = brandHtml(A.info?.brand);
  try {
    const me = await api('/api/auth/me');
    if (me.role !== 'admin') throw new Error('not admin');
    showApp();
  } catch {
    showLogin();
  }
}

function showLogin() {
  const form = $('#login');
  form.hidden = false;
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/auth/login', { method: 'POST', body: { role: 'admin', password: form.elements.password.value } });
      form.hidden = true;
      showApp();
    } catch (err) {
      $('#login-error').textContent = err.message;
      $('#login-error').hidden = false;
    }
  };
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2600);
}

async function showApp() {
  $('#app').hidden = false;
  $('#brand').innerHTML = brandHtml(A.info?.brand) + '<span class="pill in" style="margin-left:6px">Admin</span>';

  $$('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      $$('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
      if (b.dataset.tab === 'scans') loadScans();
    }),
  );
  const search = $('#search');
  search.addEventListener('submit', (e) => e.preventDefault());
  search.elements.q.addEventListener('input', () => {
    clearTimeout(A.searchTimer);
    A.searchTimer = setTimeout(loadOrders, 250);
  });
  search.elements.status.addEventListener('change', loadOrders);
  $('#orders').addEventListener('click', onOrderAction);
  $('#logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.reload();
  };

  await refreshSummary();
  buildDoorForm();
  loadOrders();
  setInterval(refreshSummary, 20000);
}

// ── summary ──────────────────────────────────────────────────────────────────

async function refreshSummary() {
  let s;
  try {
    s = A.summary = await api('/api/admin/summary');
  } catch (err) {
    if (err.status === 401) location.reload();
    return;
  }
  $('#demo-ribbon').hidden = s.paymentMode !== 'demo';
  const t = s.totals;
  const online = s.sources.online?.revenue || 0;
  const door = s.sources.door?.revenue || 0;
  const pct = t.sold ? Math.round((t.checkedIn / t.sold) * 100) : 0;
  $('#kpis').innerHTML = [
    ['Revenue', rupees(t.revenue), `Online ${rupees(online)} · Door ${rupees(door)}`],
    ['Passes sold', t.sold.toLocaleString('en-IN'), t.capacity ? `of ${t.capacity} capacity` : `${t.orders} ${t.orders === 1 ? 'booking' : 'bookings'}${s.sources.comp ? ` · ${s.sources.comp.tickets} comp` : ''}`],
    ['Checked in', t.checkedIn.toLocaleString('en-IN'), `${pct}% of passes sold`],
    ['Paying right now', t.pendingCheckouts, 'checkouts holding passes'],
  ]
    .map(([k, v, sub]) => `<div class="kpi"><span>${k}</span><b>${v}</b><small>${esc(sub)}</small></div>`)
    .join('');

  $('#pass-table').innerHTML =
    `<thead><tr><th>Pass</th><th class="num">Price</th><th>Sold</th><th class="num">Checked in</th><th class="num">Revenue</th></tr></thead><tbody>` +
    s.passes
      .map((p) => {
        const bar = p.capacity ? `<span class="bar"><i style="width:${Math.min(100, (p.sold / p.capacity) * 100)}%"></i></span>` : '';
        return `<tr>
          <td>${esc(p.emoji)} ${esc(p.name)}</td>
          <td class="num">₹${p.price.toLocaleString('en-IN')}</td>
          <td>${bar}${p.sold}${p.capacity ? ` / ${p.capacity}` : ''}</td>
          <td class="num">${p.checkedIn}</td>
          <td class="num">${rupees(p.revenue)}</td>
        </tr>`;
      })
      .join('') +
    `</tbody>`;

  $('#counters').innerHTML = Object.entries(s.perks)
    .map(([k, perk]) => {
      const entitled = s.passes.filter((p) => p.redeem.includes(k)).reduce((n, p) => n + p.sold, 0);
      return `<span class="chip">${esc(perk.icon)} ${esc(perk.label)} handed out: <b>${s.redeemed[k] || 0} / ${entitled}</b></span>`;
    })
    .join('');
  $('#updated').textContent = `Updated ${new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' })}`;
}

// ── orders ───────────────────────────────────────────────────────────────────

async function loadOrders() {
  const f = $('#search').elements;
  const qs = new URLSearchParams({ q: f.q.value, status: f.status.value });
  try {
    A.orders = await api(`/api/admin/orders?${qs}`);
  } catch (err) {
    $('#orders').innerHTML = `<p class="error">${esc(err.message)}</p>`;
    return;
  }
  $('#orders').innerHTML = A.orders.length ? A.orders.map(orderHtml).join('') : '<p class="empty">No bookings match.</p>';
}

function orderHtml(o) {
  const st = o.abandoned ? 'abandoned' : o.status;
  const items = o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join(', ');
  const tickets = o.tickets
    .map((t) => {
      const inAt = t.used?.entry?.at;
      const perkPills = Object.keys(t.used || {})
        .filter((k) => k !== 'entry')
        .map((k) => `<span class="pill in">${esc(A.summary?.perks?.[k]?.label || k)} ✓</span>`)
        .join('');
      return `<li>
        <span class="mono">${esc(t.id)}</span>
        <span class="grow">${esc(t.passName)}</span>
        ${t.status === 'void' ? '<span class="pill void">Void</span>' : inAt ? `<span class="pill valid">In ${esc(istTime(inAt, { timeStyle: 'short' }))}</span>` : '<span class="pill">Not in</span>'}
        ${perkPills}
        ${inAt ? `<button class="btn btn-ghost btn-small" data-act="undo" data-ticket="${esc(t.id)}">Undo check-in</button>` : ''}
        ${o.status === 'paid' ? (t.status === 'void'
          ? `<button class="btn btn-ghost btn-small" data-act="restore" data-ticket="${esc(t.id)}">Restore</button>`
          : `<button class="btn btn-danger btn-small" data-act="void" data-ticket="${esc(t.id)}">Void</button>`) : ''}
      </li>`;
    })
    .join('');

  const actions = [
    ['paid', 'refunded'].includes(o.status) && `<button class="btn btn-ghost btn-small" data-act="copy" data-id="${esc(o.id)}">🔗 Copy pass link</button>`,
    o.status === 'paid' && `<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="${esc(whatsappLink(o))}">💬 WhatsApp passes</a>`,
    o.status === 'paid' && o.email && `<button class="btn btn-ghost btn-small" data-act="resend" data-id="${esc(o.id)}">✉️ ${o.emailSentAt ? 'Resend' : 'Send'} email</button>`,
    o.status === 'pending' && o.source === 'online' && `<button class="btn btn-ghost btn-small" data-act="reconcile" data-id="${esc(o.id)}">🔄 Check payment with Razorpay</button>`,
    ['paid', 'pending'].includes(o.status) && `<button class="btn btn-danger btn-small" data-act="cancel" data-id="${esc(o.id)}">Cancel booking</button>`,
  ]
    .filter(Boolean)
    .join('');

  return `<details class="order">
    <summary>
      <span class="who"><span class="pill ${st}">${STATUS_LABEL[st]}</span>${esc(o.name)}</span>
      <span class="amt">${rupees(o.amount)}</span>
      <span class="meta">${esc(o.id)} · ${o.attendees} ${o.attendees === 1 ? 'pass' : 'passes'} · ${SOURCE_LABEL[o.source] || o.source} · ${esc(istTime(o.createdAt))}${o.emailSentAt ? ' · ✉️ emailed' : ''}</span>
    </summary>
    <div class="order-body">
      <div class="contact">
        📞 <a href="tel:+91${esc(o.phone)}">+91 ${esc(o.phone)}</a>${o.email ? ` · ✉️ ${esc(o.email)}` : ''}<br>
        <span class="muted">${items}${o.paymentId ? ` · Payment <span class="mono">${esc(o.paymentId)}</span>` : ''}${o.paidAt ? ` · Paid ${esc(istTime(o.paidAt))}` : ''}</span>
        ${o.note ? `<br><span class="muted">Note: ${esc(o.note)}</span>` : ''}
      </div>
      ${tickets ? `<ul class="order-tickets">${tickets}</ul>` : ''}
      <div class="actions">${actions}</div>
    </div>
  </details>`;
}

function whatsappLink(o) {
  const ev = A.info?.event?.name || 'the event';
  const text = `Hi ${o.name}! Here are your passes for ${ev} 🎉\n${o.passUrl}\nShow the QR at the gate. Each QR works once.`;
  return `https://wa.me/91${o.phone}?text=${encodeURIComponent(text)}`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copied');
  } catch {
    prompt('Copy this link:', text);
  }
}

async function onOrderAction(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const { act, id, ticket } = btn.dataset;
  const order = A.orders.find((o) => o.id === id);
  const run = async (fn, okMsg) => {
    btn.disabled = true;
    try {
      const res = await fn();
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(res) : okMsg);
      await Promise.all([loadOrders(), refreshSummary()]);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  };
  if (act === 'copy') return copy(order.passUrl);
  if (act === 'resend') return run(() => api(`/api/admin/orders/${id}/resend`, { method: 'POST' }), 'Email sent');
  if (act === 'reconcile') {
    return run(
      () => api(`/api/admin/orders/${id}/reconcile`, { method: 'POST' }),
      (r) => (r.changed ? 'Payment found: passes issued ✓' : 'No successful payment on this order yet'),
    );
  }
  if (act === 'cancel') {
    const paid = order.status === 'paid';
    const msg = paid
      ? `Cancel booking ${id} for ${order.name}?\n\nAll its passes stop working immediately.\nRefund the money separately from the Razorpay dashboard (Payments → ${order.paymentId || 'this payment'} → Refund).`
      : `Cancel pending checkout ${id}? Its reserved passes go back on sale.`;
    if (!confirm(msg)) return;
    return run(() => api(`/api/admin/orders/${id}/cancel`, { method: 'POST' }), 'Booking cancelled');
  }
  if (act === 'void') {
    if (!confirm(`Void pass ${ticket}? It will show INVALID at the gate.`)) return;
    return run(() => api(`/api/admin/tickets/${encodeURIComponent(ticket)}/void`, { method: 'POST' }), 'Pass voided');
  }
  if (act === 'restore') return run(() => api(`/api/admin/tickets/${encodeURIComponent(ticket)}/restore`, { method: 'POST' }), 'Pass restored');
  if (act === 'undo') {
    if (!confirm(`Undo the check-in for ${ticket}? It can then be scanned in again.`)) return;
    return run(() => api('/api/admin/redemptions/undo', { method: 'POST', body: { ticketId: ticket, kind: 'entry' } }), 'Check-in undone');
  }
}

// ── door sales ───────────────────────────────────────────────────────────────

function buildDoorForm() {
  const form = $('#door');
  const passes = A.summary.passOptions;
  $('#door-passes').innerHTML = passes
    .map(
      (p) => `<div class="door-row"><span>${esc(p.emoji)} ${esc(p.name)} <span class="muted">₹${p.price}</span></span>
      <input type="number" min="0" max="200" step="1" value="0" inputmode="numeric" data-pass="${esc(p.id)}" aria-label="${esc(p.name)} quantity" /></div>`,
    )
    .join('');
  const total = () => {
    if (form.elements.source.value === 'comp') return 0;
    return $$('[data-pass]', form).reduce((s, i) => s + (Number(i.value) || 0) * passes.find((p) => p.id === i.dataset.pass).price, 0);
  };
  const update = () => ($('#door-total').textContent = '₹' + total().toLocaleString('en-IN'));
  form.addEventListener('input', update);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#door-error');
    err.hidden = true;
    const f = form.elements;
    const items = $$('[data-pass]', form).map((i) => ({ passId: i.dataset.pass, qty: Number(i.value) || 0 })).filter((i) => i.qty > 0);
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const res = await api('/api/admin/orders', {
        method: 'POST',
        body: { source: f.source.value, name: f.name.value, phone: f.phone.value, email: f.email.value, note: f.note.value, items },
      });
      const qty = items.reduce((s, i) => s + i.qty, 0);
      const o = { name: f.name.value.trim(), phone: f.phone.value.replace(/\D/g, '').slice(-10), passUrl: res.passUrl };
      $('#door-result').innerHTML = `<div class="door-done">
        <b>✓ ${qty} ${qty === 1 ? 'pass' : 'passes'} issued to ${esc(o.name)}</b> · booking <span class="mono">${esc(res.id)}</span>${res.amount ? ` · collect ${rupees(res.amount)}` : ''}
        <div class="actions" style="margin-top:10px">
          <a class="btn btn-small" href="${esc(res.passUrl)}" target="_blank" rel="noopener">Show QR passes</a>
          <a class="btn btn-ghost btn-small" href="${esc(whatsappLink(o))}" target="_blank" rel="noopener">💬 WhatsApp them</a>
        </div></div>`;
      form.reset();
      update();
      refreshSummary();
      loadOrders();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  };
}

// ── scan log ─────────────────────────────────────────────────────────────────

async function loadScans() {
  const rows = await api('/api/admin/scans?limit=200').catch(() => []);
  const label = (k) => (k === 'entry' ? 'Entry' : A.summary?.perks?.[k]?.label || k);
  $('#scans').innerHTML = rows.length
    ? `<thead><tr><th>Time</th><th>Where</th><th>Mode</th><th>Result</th><th>Ticket</th><th>Name</th><th>Detail</th></tr></thead><tbody>` +
      rows
        .map(
          (r) => `<tr>
          <td>${esc(istTime(r.at, { timeStyle: 'medium' }))}</td>
          <td>${esc(r.gate)}</td>
          <td>${esc(label(r.kind))}</td>
          <td><span class="pill ${esc(r.result)}">${esc(r.result.replace('_', ' '))}</span></td>
          <td class="mono">${esc(r.ticket || '')}</td>
          <td>${esc(r.holder || '')}${r.passName ? ` <span class="muted">· ${esc(r.passName)}</span>` : ''}</td>
          <td class="muted">${esc(r.detail)}</td>
        </tr>`,
        )
        .join('') +
      '</tbody>'
    : '<tbody><tr><td class="empty">No scans yet.</td></tr></tbody>';
}
