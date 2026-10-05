import { $, api, brandHtml, esc, istTime } from './common.js';

const S = {
  info: null,
  me: null,
  mode: 'entry',
  stream: null,
  detector: null,
  busy: false,
  last: { text: '', at: 0 },
  audio: null,
  timer: null,
  wakeLock: null,
};
const SAME_CODE_COOLDOWN = 8000; // ignore the same QR still held in front of the camera
const GATE_KEY = 'delulu.gate';

boot();

async function boot() {
  S.info = await api('/api/event').catch(() => null);
  $('#login-brand').innerHTML = brandHtml(S.info?.brand);
  try {
    S.me = await api('/api/auth/me');
    if (!S.me.role) throw new Error('logged out');
    showApp();
  } catch {
    showLogin();
  }
}

// ── login ────────────────────────────────────────────────────────────────────

function showLogin() {
  const form = $('#login');
  form.hidden = false;
  $('#app').hidden = true;
  try {
    form.elements.gate.value = localStorage.getItem(GATE_KEY) || '';
  } catch {}
  form.onsubmit = async (e) => {
    e.preventDefault();
    const gate = form.elements.gate.value.trim();
    const err = $('#login-error');
    err.hidden = true;
    try {
      S.me = await api('/api/auth/login', { method: 'POST', body: { role: 'staff', password: form.elements.pin.value, gate } });
      try {
        localStorage.setItem(GATE_KEY, gate);
      } catch {}
      showApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  };
}

// ── main screen ──────────────────────────────────────────────────────────────

function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#gate').textContent = S.me.gate || 'Scanner';
  $('#role').textContent = S.me.role === 'admin' ? 'Admin' : 'Staff';

  const modes = [['entry', '🚪 Entry'], ...Object.entries(S.info?.perks || {}).map(([k, p]) => [k, `${p.icon} ${p.label}`])];
  // A counter named like a perk ("Food Counter") starts in that mode.
  const guess = modes.find(([k, label]) => k !== 'entry' && (S.me.gate || '').toLowerCase().includes(label.split(' ').pop().toLowerCase()));
  S.mode = guess ? guess[0] : 'entry';
  $('#modes').innerHTML = modes
    .map(([k, label]) => `<button type="button" data-mode="${esc(k)}" aria-pressed="${k === S.mode}">${esc(label)}</button>`)
    .join('');
  $('#modes').onclick = (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    S.mode = b.dataset.mode;
    S.last = { text: '', at: 0 };
    for (const x of $('#modes').children) x.setAttribute('aria-pressed', String(x === b));
    refreshStats();
  };

  $('#start').onclick = startCamera;
  $('#manual').onsubmit = (e) => {
    e.preventDefault();
    const input = e.target.elements.code;
    const v = input.value.trim();
    if (!v) return;
    unlockAudio();
    input.value = '';
    input.blur();
    onCode(v, { manual: true });
  };
  $('#logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    S.stream?.getTracks().forEach((t) => t.stop());
    location.reload();
  };
  $('#result').onclick = (e) => {
    if (!e.target.closest('button')) hideResult();
  };

  refreshStats();
  setInterval(refreshStats, 15000);
}

async function refreshStats() {
  try {
    const s = await api('/api/scan/stats');
    const n = s.redeemed[S.mode] || 0;
    $('#count').innerHTML = S.mode === 'entry' ? `Checked in<b>${n} / ${s.tickets}</b>` : `Handed out<b>${n}</b>`;
  } catch (err) {
    if (err.status === 401) location.reload();
  }
}

// ── camera ───────────────────────────────────────────────────────────────────

function camError(msg) {
  const el = $('#cam-error');
  el.textContent = msg;
  el.hidden = false;
}

async function startCamera() {
  unlockAudio();
  $('#cam-error').hidden = true;
  if (!navigator.mediaDevices?.getUserMedia) {
    return camError('This browser can’t use the camera here. The scanner must be opened over https://. You can still type ticket IDs below.');
  }
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (err) {
    return camError(
      err.name === 'NotAllowedError'
        ? 'Camera permission was blocked. Allow camera access for this site in your browser settings, then reload.'
        : `Couldn’t start the camera (${err.message}).`,
    );
  }
  const video = $('#video');
  video.srcObject = S.stream;
  await video.play().catch(() => {});
  $('#start').hidden = true;

  const track = S.stream.getVideoTracks()[0];
  if (track.getCapabilities?.().torch) {
    let on = false;
    $('#torch').hidden = false;
    $('#torch').onclick = () => {
      on = !on;
      track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
    };
  }
  if ('BarcodeDetector' in window) {
    try {
      if ((await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
        S.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch {}
  }
  keepAwake();
  tick();
}

async function keepAwake() {
  try {
    S.wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S.stream) keepAwake();
});

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

async function decode(video) {
  if (S.detector) {
    const codes = await S.detector.detect(video);
    return codes[0]?.rawValue || null;
  }
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !window.jsQR) return null;
  const side = Math.min(w, h);
  const size = Math.min(520, side);
  canvas.width = canvas.height = size;
  ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  return window.jsQR(img.data, size, size, { inversionAttempts: 'attemptBoth' })?.data || null;
}

async function tick() {
  const video = $('#video');
  if (!S.busy && !document.hidden && video.readyState >= 2) {
    try {
      const text = await decode(video);
      if (text) await onCode(text);
    } catch (err) {
      console.warn(err);
    }
  }
  setTimeout(tick, S.detector ? 100 : 150);
}

// ── verdicts ─────────────────────────────────────────────────────────────────

async function onCode(text, { manual = false } = {}) {
  if (S.busy) return;
  if (!manual && text === S.last.text && Date.now() - S.last.at < SAME_CODE_COOLDOWN) return;
  S.last = { text, at: Date.now() };
  S.busy = true;
  try {
    const r = await api('/api/scan', { method: 'POST', body: { code: text, kind: S.mode } });
    showResult(r);
    if (r.result === 'valid') refreshStats();
  } catch (err) {
    if (err.status === 401) return location.reload();
    showResult({ result: 'error', reason: err.status ? err.message : 'No internet. Check the connection and scan again.' });
  }
}

function modeLabel() {
  return S.mode === 'entry' ? 'Entry' : S.info?.perks?.[S.mode]?.label || S.mode;
}

function showResult(r) {
  const el = $('#result');
  const isEntry = S.mode === 'entry';
  const look = {
    valid: { icon: '✓', title: isEntry ? 'VALID' : `GIVE ${modeLabel().toUpperCase()}`, cls: 'valid' },
    used: { icon: '✕', title: isEntry ? 'ALREADY USED' : 'ALREADY COLLECTED', cls: 'used' },
    invalid: { icon: '✕', title: 'INVALID', cls: 'invalid' },
    not_included: { icon: '!', title: 'NOT INCLUDED', cls: 'not_included' },
    error: { icon: '⚠', title: 'TRY AGAIN', cls: 'not_included' },
  }[r.result];

  el.className = `result ${look.cls}`;
  $('#r-icon').textContent = look.icon;
  $('#r-title').textContent = look.title;
  $('#r-reason').textContent = r.reason || (r.result === 'valid' ? (isEntry ? 'Let them in 🎉' : 'Hand it over') : '');

  const t = r.ticket;
  $('#r-card').innerHTML = t
    ? `<div class="big">${esc(t.holder)}</div>
       <div class="row"><span>Pass</span><span>${esc(t.pass.emoji)} ${esc(t.pass.name)}</span></div>
       <div class="row"><span>Ticket</span><span class="mono">${esc(t.id)} · ${t.seq} of ${t.of}</span></div>
       <div class="row"><span>Includes</span><span>${esc(t.pass.includes.join(' · '))}</span></div>
       ${r.first ? `<div class="row"><span>First scanned</span><span>${esc(istTime(r.first.at, { timeStyle: 'short' }))}${r.first.gate ? ' · ' + esc(r.first.gate) : ''}</span></div>` : ''}`
    : '';

  const studentCheck = r.result === 'valid' && isEntry && t?.pass.audience === 'student';
  $('#r-student').hidden = !studentCheck;

  const actions = $('#r-actions');
  if (studentCheck) {
    actions.innerHTML = `<button class="btn" data-a="next">✓ ID checked</button><button class="btn secondary" data-a="undo">✕ No ID, undo</button>`;
  } else if (r.result === 'valid') {
    actions.innerHTML = `<button class="btn" data-a="next">Next</button><button class="btn secondary" data-a="undo">Undo</button>`;
  } else {
    actions.innerHTML = `<button class="btn" data-a="next">Next scan</button>`;
  }
  actions.onclick = async (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'next') hideResult();
    if (a === 'undo') {
      try {
        await api('/api/scan/undo', { method: 'POST', body: { ticketId: t.id, kind: S.mode } });
        $('#r-title').textContent = 'UNDONE';
        $('#r-reason').textContent = isEntry ? 'Not checked in. They can be scanned again later.' : 'Not handed out.';
        el.className = 'result not_included';
        $('#r-student').hidden = true;
        actions.innerHTML = `<button class="btn" data-a="next">Next scan</button>`;
        refreshStats();
      } catch (err) {
        $('#r-reason').textContent = err.message;
      }
    }
  };

  el.hidden = false;
  buzz(r.result === 'valid');
  clearTimeout(S.timer);
  // Green clears itself so the line keeps moving; red/amber wait for a tap so nobody misses it.
  if (r.result === 'valid' && !studentCheck) S.timer = setTimeout(hideResult, 1800);
}

function hideResult() {
  clearTimeout(S.timer);
  $('#result').hidden = true;
  S.last.at = Date.now();
  S.busy = false;
}

// ── sound + vibration ────────────────────────────────────────────────────────

function unlockAudio() {
  try {
    S.audio ||= new (window.AudioContext || window.webkitAudioContext)();
    S.audio.resume();
  } catch {}
}

function buzz(ok) {
  navigator.vibrate?.(ok ? 90 : [220, 90, 220]);
  const a = S.audio;
  if (!a) return;
  const tone = (freq, start, dur, type) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, a.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.35, a.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start);
    o.stop(a.currentTime + start + dur + 0.02);
  };
  if (ok) {
    tone(880, 0, 0.12, 'sine');
    tone(1320, 0.12, 0.16, 'sine');
  } else {
    tone(180, 0, 0.5, 'square');
  }
}
