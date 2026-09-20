import nodemailer from 'nodemailer';

let transporter;

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required for email delivery`);
  return value;
}

function mailConfig() {
  const port = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 465);
  return {
    host: process.env.MAIL_HOST || process.env.SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.MAIL_USER || process.env.SMTP_USER || required('MAIL_USER'),
      pass: process.env.MAIL_PASS || process.env.SMTP_PASS || required('MAIL_PASS'),
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  };
}

export function getTransporter() {
  if (!transporter) transporter = nodemailer.createTransport(mailConfig());
  return transporter;
}

export async function verifyMailer() {
  return getTransporter().verify();
}

export async function sendMail(to, subject, html, text) {
  const sender = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.MAIL_USER;
  const replyTo = process.env.MAIL_REPLY_TO || process.env.SUPPORT_EMAIL || sender;
  return getTransporter().sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'Khatu Pay'}" <${sender}>`,
    replyTo,
    to,
    subject,
    html,
    text,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildOtpEmail({ name, otp, purpose = 'verification', expiresMinutes = 10 }) {
  const firstName = String(name || 'Customer').trim().split(/\s+/)[0];
  const labels = {
    email_verify: ['Verify your email', 'email verification'],
    password_reset: ['Reset your password', 'password reset'],
    pin_reset: ['Reset your PIN', 'PIN reset'],
  };
  const [heading, action] = labels[purpose] || ['Verify your request', purpose];
  const subject = `${heading} - Khatu Pay`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033">
<div style="max-width:560px;margin:0 auto;padding:28px 16px">
  <div style="background:#fff;border:1px solid #e4e9f2;border-radius:12px;overflow:hidden">
    <div style="background:#0a7b68;padding:22px 24px;color:#fff">
      <div style="font-size:22px;font-weight:800">Khatu Pay</div>
      <div style="margin-top:5px;font-size:13px;opacity:.9">Secure account verification</div>
    </div>
    <div style="padding:26px 24px">
      <h1 style="margin:0 0 12px;font-size:21px">${heading}</h1>
      <p style="margin:0;color:#526071;line-height:1.6">Hi ${escapeHtml(firstName)}, use this one-time password to complete your ${escapeHtml(action)}.</p>
      <div style="margin:24px 0;padding:18px;text-align:center;background:#eef9f6;border:1px solid #ccebe3;border-radius:10px;font-size:30px;font-weight:800;letter-spacing:8px;color:#086b5b">${escapeHtml(otp)}</div>
      <p style="margin:0;color:#526071;font-size:14px;line-height:1.6">This OTP expires in ${Number(expiresMinutes)} minutes. Never share it with anyone, including Khatu Pay support.</p>
      <p style="margin:22px 0 0;color:#8a94a3;font-size:12px;line-height:1.6">If you did not request this, you can safely ignore this email or contact support.</p>
    </div>
  </div>
</div></body></html>`;
  const text = `Hi ${firstName},\n\nYour Khatu Pay OTP for ${action} is ${otp}. It expires in ${expiresMinutes} minutes. Never share this OTP with anyone.\n\nIf you did not request this, ignore this email.`;
  return { subject, html, text };
}

export async function sendOtpMail(to, details) {
  const message = buildOtpEmail(details);
  return sendMail(to, message.subject, message.html, message.text);
}
