import { $, api, brandHtml, esc, istTime, myPasses, rupees } from './common.js';

const [, kind, key] = location.pathname.split('/'); // /p/<token> or /t/<ID.SIG>
const single = kind === 't';
let polls = 0;

$('#brand').innerHTML = brandHtml();
load(false);

async function load(refresh) {
  try {
    const path = single ? `/api/ticket/${encodeURIComponent(key)}` : `/api/pass/${encodeURIComponent(key)}${refresh ? '/refresh' : ''}`;
    const view = await api(path, { method: refresh ? 'POST' : 'GET' });
    render(view);
  } catch (err) {
    if (refresh && (err.status === 429 || !err.status)) return setTimeout(() => load(true), 10000); // busy / offline: keep waiting
    showState(`<p style="font-size:2rem">🤔</p><h2>We couldn't find that pass</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="/">Go to the event page</a>`);
  }
}

function showState(html) {
  const el = $('#state');
  el.innerHTML = html;
  el.hidden = false;
}

function render(view) {
  const { order, tickets, event } = view;
  $('#brand').innerHTML = brandHtml(event.brand);
  document.title = `Your passes · ${event.name}`;

  if (order.status === 'pending') return renderPending(order);
  if (order.status === 'failed') {
    return showState(`<h2>This checkout didn't go through</h2><p class="muted">No passes were issued for booking ${esc(order.id)}.</p><a class="btn" href="/#passes">Book again</a>`);
  }

  $('#state').hidden = true;
  $('#success').hidden = false;
  if (!single) myPasses.add(key, `${order.attendees} passes`);

  if (order.status === 'refunded') {
    $('#hello-title').textContent = 'Booking cancelled';
    $('#hello-sub').textContent = `Booking ${order.id} was cancelled. These passes no longer work.`;
    $('#save-tip').hidden = true;
  } else if (single) {
    $('#hello-title').textContent = 'Your pass 🎉';
    $('#hello-sub').textContent = `Booked by ${order.name}. Show this QR at the gate.`;
  } else {
    $('#hello-sub').innerHTML = `Booking <b class="mono">${esc(order.id)}</b> · ${order.attendees} ${order.attendees === 1 ? 'pass' : 'passes'}${order.amount ? ` · ${rupees(order.amount)} paid` : ''}`;
  }

  $('#tickets').innerHTML = tickets.map((t) => ticketHtml(t, event)).join('');
  $('#print').onclick = () => print();
  $('#share-all').hidden = single;
  $('#share-all').onclick = () => share(location.href, `My passes for ${event.name}`);
  for (const btn of document.querySelectorAll('[data-share]')) {
    btn.onclick = () => share(btn.dataset.share, `Here's your pass for ${event.name} 🎉 Show the QR at the gate. Don't share it with anyone else, it works once.`);
  }
}

function renderPending(order) {
  const expired = new Date(order.expiresAt) < new Date();
  polls++;
  if (polls <= 30) {
    showState(`<span class="spinner"></span>
      <h2>Confirming your payment…</h2>
      <p class="muted">Booking <b class="mono">${esc(order.id)}</b>. This usually takes a few seconds. Please don't pay again.</p>
      ${expired ? '<p class="muted">If you closed the payment window without paying, <a href="/#passes">start a new booking</a>.</p>' : ''}`);
    setTimeout(() => load(true), polls < 6 ? 2500 : 6000);
  } else {
    showState(`<h2>Still waiting for the bank</h2>
      <p class="muted">If money was deducted, this booking (<b class="mono">${esc(order.id)}</b>) confirms automatically, so just reopen this page later.
      Otherwise nothing was charged and you can <a href="/#passes">book again</a>.</p>
      <button class="btn" type="button" onclick="location.reload()">Check again</button>`);
  }
}

function ticketHtml(t, event) {
  const used = t.used?.entry;
  const statusText =
    t.status === 'void' ? 'Cancelled' : used ? `Checked in · ${istTime(used.at, { timeStyle: 'short', dateStyle: 'medium' })}` : 'Ready to scan';
  const statusClass = t.status === 'void' ? 'void' : used ? 'used' : '';
  const perks = (t.pass.redeem || [])
    .map((k) => {
      const p = event.perks?.[k];
      const got = t.used?.[k];
      return p ? `<li class="${got ? 'done' : ''}">${esc(p.icon)} ${esc(p.label)}: ${got ? 'collected' : 'not collected yet'}</li>` : '';
    })
    .join('');
  return `
  <article class="ticket ${statusClass}">
    <div class="t-head">
      <div><div class="t-brand">${esc(event.brand)}</div><div class="t-event">${esc(event.name)}</div></div>
      <div class="t-kind">${esc(t.pass.emoji)} ${esc(t.pass.name)}</div>
    </div>
    <div class="t-qr">
      <div class="qr" role="img" aria-label="QR code for pass ${esc(t.id)}">${t.qrSvg}</div>
      <div class="t-id">${esc(t.id)}</div>
    </div>
    ${t.pass.audience === 'student' ? '<div class="t-student">🎓 Student pass: carry your college ID</div>' : ''}
    <div class="t-perf"></div>
    <dl class="t-meta">
      <div><dt>Name</dt><dd>${esc(t.holder)}</dd></div>
      <div><dt>Admits</dt><dd>1 person · ${t.seq} of ${t.of}</dd></div>
      <div><dt>Date</dt><dd>${esc(event.date)}</dd></div>
      <div><dt>Time</dt><dd>${esc(event.time)}</dd></div>
      <div class="wide"><dt>Venue</dt><dd>${esc(event.venue)}${event.city ? ', ' + esc(event.city) : ''}</dd></div>
      <div class="wide"><dt>Includes</dt><dd><ul class="includes" style="margin:4px 0 0">${t.pass.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></dd></div>
      ${perks ? `<div class="wide"><dt>Collect at counters (show this QR)</dt><dd><ul class="perks">${perks}</ul></dd></div>` : ''}
    </dl>
    <div class="t-foot">
      <span class="status-pill ${statusClass}">${esc(statusText)}</span>
      ${t.status === 'void' || single ? '' : `<button class="btn btn-ghost btn-small t-share" type="button" data-share="${esc(t.shareUrl)}">📤 Send this pass</button>`}
    </div>
  </article>`;
}

async function share(url, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, text, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
}
