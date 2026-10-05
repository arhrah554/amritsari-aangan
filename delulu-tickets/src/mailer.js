import nodemailer from 'nodemailer';

/** Returns null when SMTP isn't configured. The site still works; buyers just get their passes on screen. */
export function createMailer(cfg) {
  if (!cfg.smtp) return null;
  const transport = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
  });
  return { send: (message) => transport.sendMail({ from: cfg.mailFrom, ...message }) };
}
