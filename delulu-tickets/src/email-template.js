const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The confirmation email: one QR per pass, plus a button to the live pass page. */
export function passEmail({ brand, event, order, tickets, passUrl }) {
  const subject = `Your passes for ${event.name}: booking ${order.id}`;
  const blocks = tickets
    .map(
      (t) => `
      <tr><td style="padding:12px 0">
        <table role="presentation" width="100%" style="background:#ffffff;border-radius:14px;border:2px dashed #f2b8d8">
          <tr>
            <td style="padding:16px;vertical-align:top;font-family:Arial,sans-serif;color:#2a0a3d">
              <div style="font-size:12px;letter-spacing:2px;color:#c2187a;font-weight:bold">PASS ${t.seq} OF ${tickets.length}</div>
              <div style="font-size:20px;font-weight:bold;margin:6px 0">${esc(t.pass.emoji)} ${esc(t.pass.name)}</div>
              <div style="font-size:14px;color:#555">${esc(t.pass.includes.join(' · '))}</div>
              ${t.pass.audience === 'student' ? '<div style="font-size:13px;color:#b45309;margin-top:8px"><b>Carry your college ID</b>: it is checked at entry.</div>' : ''}
              <div style="font-family:monospace;font-size:16px;margin-top:10px;letter-spacing:1px">${esc(t.id)}</div>
            </td>
            <td style="padding:12px;width:170px" align="right">
              <img src="cid:${t.cid}" width="160" height="160" alt="QR code for ${esc(t.id)}" style="display:block">
            </td>
          </tr>
        </table>
      </td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><body style="margin:0;background:#f6eefc">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6eefc;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px">
        <tr><td style="background:linear-gradient(135deg,#3b0764,#c2187a 60%,#f59e0b);background-color:#6b1a7a;border-radius:18px;padding:28px 24px;color:#fff;font-family:Arial,sans-serif">
          <div style="font-size:12px;letter-spacing:3px;opacity:.9">${esc(brand)}</div>
          <div style="font-size:30px;font-weight:bold;margin:6px 0">${esc(event.name)}</div>
          <div style="font-size:14px;opacity:.95">${esc(event.date)} · ${esc(event.time)}<br>${esc(event.venue)}, ${esc(event.city)}</div>
        </td></tr>
        <tr><td style="padding:20px 4px 4px;font-family:Arial,sans-serif;color:#2a0a3d;font-size:15px">
          Hi ${esc(order.name)}, you're in! 🎉 Here ${tickets.length === 1 ? 'is your pass' : `are your ${tickets.length} passes`}.
          Show the QR code at the entrance. <b>Each QR lets one person in, once</b>, so don't post it online.
        </td></tr>
        ${blocks}
        <tr><td align="center" style="padding:16px 0 8px">
          <a href="${esc(passUrl)}" style="background:#c2187a;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;padding:14px 26px;border-radius:999px;display:inline-block">Open my passes</a>
        </td></tr>
        <tr><td style="font-family:Arial,sans-serif;color:#6b5a78;font-size:12px;padding:12px 4px;text-align:center">
          Booking ${esc(order.id)} · ₹${(order.amount / 100).toLocaleString('en-IN')} paid<br>
          ${event.contactPhone ? `Questions? Call/WhatsApp ${esc(event.contactPhone)}` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  const text = [
    `${brand}: ${event.name}`,
    `${event.date} · ${event.time} · ${event.venue}, ${event.city}`,
    '',
    `Hi ${order.name}, you're in! Booking ${order.id}.`,
    ...tickets.map((t) => `  Pass ${t.seq}: ${t.pass.name} (${t.id})`),
    '',
    `Your QR passes: ${passUrl}`,
    'Each QR lets one person in, once. Don\'t post it online.',
  ].join('\n');

  return { subject, html, text };
}
