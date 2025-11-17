import nodemailer from 'nodemailer';
let transporter;
export function getTransporter(){ if (transporter) return transporter; const {MAIL_HOST,MAIL_PORT,MAIL_USER,MAIL_PASS}=process.env; transporter = nodemailer.createTransport({ host:MAIL_HOST, port:parseInt(MAIL_PORT||'587',10), secure:false, auth:{ user:MAIL_USER, pass:MAIL_PASS } }); return transporter; }
export async function sendMail(to, subject, html, text){ const from = process.env.MAIL_FROM || 'khatupay@gmail.com'; return getTransporter().sendMail({ from, to, subject, html, text }); }
