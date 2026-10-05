import { $, $$, api, brandHtml, esc, myPasses, rupees } from './common.js';

const state = {
  info: null,
  cart: {}, // passId -> qty
  pending: null, // { order, key, expiresAt }: lets a cancelled payment be retried without re-reserving
};

const passById = (id) => state.info.passes.find((p) => p.id === id);
const cartLines = () =>
  state.info.passes.filter((p) => state.cart[p.id] > 0).map((pass) => ({ pass, qty: state.cart[pass.id] }));
const cartQty = () => cartLines().reduce((s, l) => s + l.qty, 0);
const cartTotal = () => cartLines().reduce((s, l) => s + l.qty * l.pass.price, 0); // rupees
const cartKey = () => JSON.stringify(cartLines().map((l) => [l.pass.id, l.qty]));

drawMandala();
init().catch((err) => {
  $('#passes .wrap').insertAdjacentHTML('beforeend', `<p class="error">${esc(err.message)}</p>`);
});

async function init() {
  const info = (state.info = await api('/api/event'));
  const ev = info.event;
  document.title = `${ev.name} · ${info.brand}`;
  $('#brand').innerHTML = brandHtml(info.brand);
  $('#presents').textContent = `${info.brand} presents`;
  const words = ev.name.split(' ');
  $('#title').innerHTML = words.length > 1 ? `<span>${esc(words[0])}</span><span>${esc(words.slice(1).join(' '))}</span>` : esc(ev.name);
  $('#tagline').textContent = ev.tagline;
  $('#facts').innerHTML = [
    ev.venue && `<a class="chip" href="${esc(ev.mapsUrl || '#')}" target="_blank" rel="noopener">📍 ${esc(ev.venue)}</a>`,
    ev.date && `<span class="chip">📅 ${esc(ev.date)}</span>`,
    ev.time && `<span class="chip">🕖 ${esc(ev.time)}</span>`,
  ]
    .filter(Boolean)
    .join('');
  $('#footer-brand').textContent = `© ${new Date().getFullYear()} ${info.brand}`;
  $('#footer-contact').innerHTML = [
    ev.contactPhone && `📞 ${esc(ev.contactPhone)}`,
    ev.contactEmail && `✉️ <a href="mailto:${esc(ev.contactEmail)}">${esc(ev.contactEmail)}</a>`,
    ev.instagram && `📸 <a href="https://instagram.com/${esc(ev.instagram)}" target="_blank" rel="noopener">@${esc(ev.instagram)}</a>`,
  ]
    .filter(Boolean)
    .join(' · ');
  $('#demo-ribbon').hidden = info.paymentMode !== 'demo';
  $('#closed').hidden = info.salesOpen;

  const mine = myPasses.list();
  if (mine.length) {
    const link = $('#my-passes');
    link.href = `/p/${mine[0].token}`;
    link.hidden = false;
  }

  renderPasses();
  wireCheckout();
}

function renderPasses() {
  const { passes, salesOpen } = state.info;
  for (const group of $$('.group')) {
    const list = passes.filter((p) => p.audience === group.dataset.audience);
    group.hidden = !list.length;
    $('.grid', group).innerHTML = list.map(passCard).join('');
  }
  for (const card of $$('.pass')) {
    const id = card.dataset.id;
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-step]');
      if (!btn || btn.disabled) return;
      setQty(id, (state.cart[id] || 0) + Number(btn.dataset.step));
    });
  }
  if (!salesOpen) $$('.stepper').forEach((s) => (s.hidden = true));
  refreshCart();
}

function passCard(p) {
  const isVip = /vip/i.test(p.id + p.name);
  const tag = p.audience === 'student'
    ? '<span class="tag tag-student">Student · ID required</span>'
    : isVip ? '<span class="tag tag-vip">VIP</span>' : '<span class="tag tag-all">Open to all</span>';
  return `
    <article class="pass ${isVip ? 'vip' : ''} ${p.soldOut ? 'soldout' : ''}" data-id="${esc(p.id)}">
      <div class="pass-top"><span class="pass-emoji" aria-hidden="true">${esc(p.emoji)}</span>${tag}</div>
      <h4>${esc(p.name)}</h4>
      <p class="blurb">${esc(p.blurb)}</p>
      <ul class="includes">${p.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="pass-foot">
        <div class="price">₹${p.price.toLocaleString('en-IN')} <small>/ person</small></div>
        ${p.soldOut ? '<span class="soldout-badge">SOLD OUT</span>' : `
        <div class="stepper" role="group" aria-label="How many ${esc(p.name)}">
          <button type="button" data-step="-1" aria-label="One less">−</button>
          <output aria-live="polite">0</output>
          <button type="button" data-step="1" aria-label="One more">+</button>
        </div>`}
      </div>
      ${p.left != null && !p.soldOut ? `<div class="left">🔥 Only ${p.left} left</div>` : ''}
    </article>`;
}

function setQty(id, qty) {
  const pass = passById(id);
  const others = cartQty() - (state.cart[id] || 0);
  const max = Math.min(state.info.maxPerOrder - others, pass.left ?? Infinity);
  state.cart[id] = Math.max(0, Math.min(qty, max));
  refreshCart();
}

function refreshCart() {
  const total = cartQty();
  for (const card of $$('.pass')) {
    const id = card.dataset.id;
    const qty = state.cart[id] || 0;
    const out = $('output', card);
    if (!out) continue;
    out.textContent = qty;
    card.classList.toggle('selected', qty > 0);
    $('[data-step="-1"]', card).disabled = qty === 0;
    const pass = passById(id);
    $('[data-step="1"]', card).disabled = total >= state.info.maxPerOrder || (pass.left != null && qty >= pass.left);
  }
  $('#cartbar').hidden = total === 0;
  $('#cart-count').textContent = `${total} ${total === 1 ? 'pass' : 'passes'} · ${total} ${total === 1 ? 'person' : 'people'}`;
  $('#cart-total').textContent = '₹' + cartTotal().toLocaleString('en-IN');
}

// ── checkout ─────────────────────────────────────────────────────────────────

function wireCheckout() {
  const dialog = $('#checkout');
  const form = $('#checkout-form');
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('#open-checkout').addEventListener('click', () => {
    renderSummary();
    showError('');
    dialog.showModal();
    setTimeout(() => form.elements.name.focus(), 50);
  });
  form.addEventListener('input', () => showError(''));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const f = form.elements;
    if (!f.name.value.trim()) return showError('Please enter your name.', f.name);
    if (f.phone.value.replace(/\D/g, '').length < 10) return showError('Please enter your 10-digit mobile number.', f.phone);
    if (!f.email.checkValidity() || !f.email.value) return showError('Please enter a valid email. Your passes are sent there.', f.email);
    if (!f.agree.checked) return showError('Please accept the terms to continue.', f.agree);
    await pay({ name: f.name.value, phone: f.phone.value, email: f.email.value });
  });
}

function renderSummary() {
  const lines = cartLines();
  $('#summary').innerHTML =
    lines
      .map(
        (l) => `<div class="summary-row"><span>${l.qty} × ${esc(l.pass.emoji)} ${esc(l.pass.name)}</span><span>₹${(l.qty * l.pass.price).toLocaleString('en-IN')}</span></div>`,
      )
      .join('') +
    `<div class="summary-row muted"><span>Attendees</span><span>${cartQty()} ${cartQty() === 1 ? 'person' : 'people'}</span></div>` +
    `<div class="summary-row total"><span>Total</span><span>₹${cartTotal().toLocaleString('en-IN')}</span></div>`;
  $('#student-notice').hidden = !lines.some((l) => l.pass.audience === 'student');
  $('#pay-btn').textContent = `Pay ₹${cartTotal().toLocaleString('en-IN')}`;
}

function showError(msg, field) {
  const el = $('#checkout-error');
  el.textContent = msg;
  el.hidden = !msg;
  if (field) field.focus();
}

function busy(on, label) {
  const btn = $('#pay-btn');
  btn.disabled = on;
  btn.innerHTML = on ? `<span class="spinner"></span> ${esc(label)}` : `Pay ₹${cartTotal().toLocaleString('en-IN')}`;
}

async function pay(buyer) {
  busy(true, 'Reserving your passes…');
  try {
    // Re-use the reservation if the buyer closed Razorpay and is trying again with the same cart.
    const key = cartKey() + JSON.stringify(buyer);
    let order = state.pending?.key === key && state.pending.expiresAt > Date.now() ? state.pending.order : null;
    if (!order) {
      order = await api('/api/orders', {
        method: 'POST',
        body: { ...buyer, items: cartLines().map((l) => ({ passId: l.pass.id, qty: l.qty })) },
      });
      state.pending = { order, key, expiresAt: Date.now() + state.info.holdMinutes * 60e3 - 30e3 };
      myPasses.add(order.token, `${cartQty()} passes`);
    }
    if (order.payment.mode === 'razorpay') await razorpayCheckout(order, buyer);
    else await demoCheckout(order);
  } catch (err) {
    showError(err.message);
    busy(false);
  }
}

async function demoCheckout(order) {
  const dlg = $('#demo-pay');
  $('#demo-amount').textContent = rupees(order.amount);
  busy(false);
  dlg.showModal();
  const btn = $('#demo-success');
  btn.onclick = async () => {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Confirming…';
    try {
      const res = await api(`/api/orders/${order.token}/demo-pay`, { method: 'POST' });
      location.href = res.passUrl;
    } catch (err) {
      dlg.close();
      showError(err.message);
      btn.disabled = false;
      btn.textContent = '✓ Simulate successful payment';
    }
  };
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the payment window. Check your internet and try again.'));
    document.head.append(s);
  });
}

async function razorpayCheckout(order, buyer) {
  busy(true, 'Opening payment…');
  await loadRazorpay();
  const info = state.info;
  const rzp = new window.Razorpay({
    key: order.payment.keyId,
    order_id: order.payment.orderId,
    amount: order.amount,
    currency: 'INR',
    name: info.brand,
    description: `${info.event.name}: ${cartQty()} pass${cartQty() > 1 ? 'es' : ''}`,
    prefill: { name: buyer.name, email: buyer.email, contact: '+91' + buyer.phone.replace(/\D/g, '').slice(-10) },
    notes: { booking: order.id },
    theme: { color: '#c2187a' },
    timeout: order.payment.timeoutSeconds,
    retry: { enabled: true },
    handler: async (resp) => {
      busy(true, 'Confirming payment…');
      try {
        const res = await api(`/api/orders/${order.token}/verify`, { method: 'POST', body: resp });
        location.href = res.passUrl;
      } catch (err) {
        // The webhook / pass page will still pick it up; send them there to wait.
        location.href = `/p/${order.token}`;
      }
    },
    modal: {
      ondismiss: () => {
        busy(false);
        showError(`Payment not completed. Your passes are held for ${info.holdMinutes} minutes. Tap Pay to try again.`);
      },
    },
  });
  rzp.on('payment.failed', (resp) => {
    showError(resp?.error?.description || 'Payment failed. Please try another method.');
  });
  rzp.open();
}

// Decorative mandala behind the hero title.
function drawMandala() {
  const petals = (n, r, rx, ry) =>
    Array.from({ length: n }, (_, i) => `<ellipse cx="0" cy="${-r}" rx="${rx}" ry="${ry}" transform="rotate(${(360 / n) * i})"/>`).join('');
  const dots = (n, r, size) =>
    Array.from({ length: n }, (_, i) => `<circle cx="0" cy="${-r}" r="${size}" transform="rotate(${(360 / n) * i})"/>`).join('');
  $('#mandala').innerHTML = `
    <g fill="none" stroke="currentColor" stroke-width="0.7">
      <circle r="97"/><circle r="91" stroke-dasharray="1.5 3"/>
      ${petals(24, 72, 6, 17)}${petals(12, 46, 9, 15)}
      <circle r="31"/><circle r="26" stroke-dasharray="1 2.5"/>${petals(8, 15, 4, 9)}
    </g>
    <g fill="currentColor">${dots(24, 84, 1.8)}${dots(12, 58, 1.4)}</g>`;
}
