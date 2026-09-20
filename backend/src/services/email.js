import { sendMail } from './mailer.js';

export const sendEmail = (to, subject, html, text) => sendMail(to, subject, html, text);

export default sendEmail;
