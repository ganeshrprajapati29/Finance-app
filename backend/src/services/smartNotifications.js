import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendFCMToTokenDetailed } from './fcm.js';
import { sendMail } from './mailer.js';

const BRAND = {
  name: 'Khatu Pay',
  color: process.env.KHATUPAY_BRAND_COLOR || '#1557ff',
  accent: process.env.KHATUPAY_BRAND_ACCENT || '#00a86b',
  logoUrl: process.env.KHATUPAY_LOGO_URL || 'https://khatupay.com/khatulogo-removebg-preview.png',
  supportEmail: process.env.SUPPORT_EMAIL || process.env.MAIL_FROM || 'support@khatupay.com',
};

function formatAmount(amount) {
  const value = Number(amount || 0);
  return `Rs. ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function firstName(user) {
  return String(user?.name || 'there').trim().split(/\s+/)[0] || 'there';
}

function paymentLabel(payment) {
  switch (payment?.type) {
    case 'REPAYMENT':
      return 'loan repayment';
    case 'FULL_REPAYMENT':
      return 'full loan repayment';
    case 'BILL':
      return 'bill payment';
    case 'P2P':
      return 'money transfer';
    case 'WALLET_TOPUP':
      return 'wallet top-up';
    case 'WALLET_SPEND':
      return 'wallet payment';
    case 'PART_PAYMENT':
      return 'part payment';
    case 'PENALTY':
      return 'penalty payment';
    case 'RECHARGE':
      return 'recharge';
    case 'BBPS_BILL':
      return 'bill payment';
    default:
      return 'payment';
  }
}

function safeText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function deviceLabel(value) {
  const text = safeText(value, 'your device');
  if (text.length <= 80) return text;
  return `${text.slice(0, 77)}...`;
}

function buildEmailHtml(template, user, context = {}) {
  const route = context.route || template.route || '/notifications';
  const actionUrl = `${process.env.PUBLIC_APP_URL || 'https://khatupay.com'}${route}`;
  const details = [
    context.amount ? ['Amount', formatAmount(context.amount)] : null,
    context.reference ? ['Reference', context.reference] : null,
    context.ip ? ['IP address', context.ip] : null,
    context.device ? ['Device', deviceLabel(context.device)] : null,
    context.adminAction ? ['Action', context.adminAction] : null,
  ].filter(Boolean);

  const detailsHtml = details.length
    ? `<table style="width:100%;margin-top:18px;border-collapse:collapse">${details.map(([label, value]) => `
        <tr>
          <td style="padding:10px 0;color:#667085;font-size:13px;border-bottom:1px solid #eef2f7">${label}</td>
          <td style="padding:10px 0;color:#101828;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #eef2f7">${value}</td>
        </tr>`).join('')}</table>`
    : '';

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#101828">
      <div style="max-width:560px;margin:0 auto;padding:28px 16px">
        <div style="background:#ffffff;border:1px solid #e7edf5;border-radius:18px;overflow:hidden">
          <div style="padding:22px 24px;background:${BRAND.color};color:#ffffff">
            <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="height:38px;max-width:150px;object-fit:contain;background:#fff;border-radius:10px;padding:4px" />
            <h1 style="margin:18px 0 0;font-size:22px;line-height:1.3">${template.title}</h1>
          </div>
          <div style="padding:24px">
            <p style="margin:0;color:#344054;font-size:15px;line-height:1.7">${template.message}</p>
            ${detailsHtml}
            <a href="${actionUrl}" style="display:inline-block;margin-top:22px;background:${BRAND.accent};color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 18px">Open Khatu Pay</a>
            <p style="margin:22px 0 0;color:#98a2b3;font-size:12px;line-height:1.6">If this activity was not done by you, contact ${BRAND.supportEmail} immediately.</p>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

function shouldSendEmail(event, context = {}) {
  if (context.email === false) return false;
  if (context.email === true || context.forceEmail === true) return true;
  return [
    'loan_application_submitted',
    'security_alert',
    'password_changed',
    'kyc_submitted',
    'kyc_approved',
    'kyc_rejected',
    'loan_approved',
    'loan_rejected',
    'loan_disbursed',
    'payment_confirmed',
    'payment_pending',
    'money_received',
    'service_refunded',
    'support_created',
    'support_updated',
    'emi_due_soon',
    'emi_overdue',
    'admin_user_action',
    'business_qr_pending',
    'business_qr_approved',
    'business_qr_rejected',
  ].includes(event);
}

function buildTemplate(event, user, context = {}) {
  const name = firstName(user);
  const amount = formatAmount(context.amount);
  const loanAccount = context.loanAccountNumber ? ` (${context.loanAccountNumber})` : '';

  const templates = {
    loan_application_submitted: {
      title: `Hi ${name}, your loan request is submitted`,
      message: `We have received your loan request for ${amount}. KhatuPay will notify you as soon as the review is complete.`,
      type: 'loan',
      priority: 'HIGH',
      route: '/loans',
    },
    loan_approved: {
      title: `Congratulations ${name}, your loan is approved`,
      message: `Your KhatuPay loan${loanAccount} for ${amount} has been approved. Please review the terms before disbursement.`,
      type: 'loan',
      priority: 'HIGH',
      route: context.loanId ? `/loan/${context.loanId}` : '/loans',
    },
    loan_rejected: {
      title: `${name}, your loan request update is ready`,
      message: 'Your loan request could not be approved right now. You can review your profile and apply again when eligible.',
      type: 'loan',
      priority: 'MEDIUM',
      route: '/loans',
    },
    loan_disbursed: {
      title: `${name}, funds have been disbursed`,
      message: `${amount} has been disbursed for your KhatuPay loan${loanAccount}. Track EMI schedule and repayments in the app.`,
      type: 'loan',
      priority: 'HIGH',
      route: context.loanId ? `/loan/${context.loanId}` : '/loans',
    },
    payment_confirmed: {
      title: `${name}, payment successful`,
      message: `Your ${paymentLabel(context.payment)} of ${amount} is confirmed. Receipt is available in payment history.`,
      type: 'payment',
      priority: 'HIGH',
      route: '/payment-history',
    },
    money_received: {
      title: `${name}, money received`,
      message: `${formatAmount(context.amount)} has been received from ${context.senderName || 'a KhatuPay user'}.`,
      type: 'payment',
      priority: 'HIGH',
      route: '/payment-history',
    },
    service_refunded: {
      title: `${name}, ${paymentLabel(context.payment)} failed`,
      message: `Your ${paymentLabel(context.payment)} of ${amount} could not be completed. The amount has been refunded to your ${context.refundedToWallet ? 'KhatuPay wallet' : 'payment method'}.`,
      type: 'payment',
      priority: 'HIGH',
      route: '/payment-history',
    },
    login_success: {
      title: `${name}, new login to your account`,
      message: `Your Khatu Pay account was accessed from ${deviceLabel(context.device)}${context.ip ? ` using IP ${context.ip}` : ''}.`,
      type: 'general',
      priority: 'LOW',
      route: '/notifications',
    },
    login_suspicious: {
      title: `${name}, unusual login detected`,
      message: `We noticed a login from a new device or IP. If this was you, no action is needed. If not, change your password immediately.`,
      type: 'general',
      priority: 'HIGH',
      route: '/settings',
    },
    security_alert: {
      title: `${name}, security alert`,
      message: context.message || 'We found unusual activity on your Khatu Pay account. Please review your account activity.',
      type: 'general',
      priority: 'HIGH',
      route: '/settings',
    },
    password_changed: {
      title: `${name}, password updated`,
      message: 'Your Khatu Pay password was changed successfully. If this was not you, contact support immediately.',
      type: 'general',
      priority: 'HIGH',
      route: '/settings',
    },
    admin_user_action: {
      title: `${name}, account update from Khatu Pay`,
      message: context.message || 'A Khatu Pay team action has updated your account. Please open the app for details.',
      type: context.type || 'general',
      priority: context.priority || 'MEDIUM',
      route: context.route || '/notifications',
    },
    business_qr_pending: {
      title: `${name}, your Business QR request is under review`,
      message: `We have received the details for ${context.businessName || 'your business'}. Our team is reviewing the profile, KYC and settlement bank details. You will receive an update after review.`,
      type: 'business',
      priority: 'MEDIUM',
      route: '/business',
    },
    business_qr_approved: {
      title: `${name}, your Business QR is approved`,
      message: `Congratulations. ${context.businessName || 'Your business'} is approved for Khatu Pay Business QR collections. Customers can scan your QR and payments will be processed securely through VelxaPay.`,
      type: 'business',
      priority: 'HIGH',
      route: '/business/qr',
    },
    business_qr_rejected: {
      title: `${name}, your Business QR request needs attention`,
      message: context.reason
        ? `Your Business QR request for ${context.businessName || 'your business'} could not be approved right now. Reason: ${context.reason}`
        : `Your Business QR request for ${context.businessName || 'your business'} could not be approved right now. Please review the details and submit again.`,
      type: 'business',
      priority: 'HIGH',
      route: '/business/verification',
    },
    kyc_submitted: {
      title: `${name}, KYC submitted successfully`,
      message: 'Your KYC documents have been submitted for review. We will notify you once verification is complete.',
      type: 'kyc',
      priority: 'MEDIUM',
      route: '/kyc',
    },
    kyc_approved: {
      title: `${name}, your KYC is approved`,
      message: context.data?.kycNumber
        ? `Your KhatuPay profile verification is complete. KYC number: ${context.data.kycNumber}.`
        : 'Your KhatuPay profile verification is complete. You can now access eligible services with fewer interruptions.',
      type: 'kyc',
      priority: 'HIGH',
      route: '/kyc',
    },
    kyc_rejected: {
      title: `${name}, KYC needs your attention`,
      message: context.notes
        ? `Your KYC document needs correction: ${context.notes}`
        : 'One or more KYC documents need correction. Please upload valid details again.',
      type: 'kyc',
      priority: 'HIGH',
      route: '/kyc',
    },
    support_created: {
      title: `${name}, your support ticket is created`,
      message: `We have received your request: ${context.subject || 'Support request'}. Our team will update you shortly.`,
      type: 'support',
      priority: 'MEDIUM',
      route: '/support',
    },
    support_updated: {
      title: `${name}, support ticket updated`,
      message: `Your ticket "${context.subject || 'Support request'}" is now ${String(context.status || 'updated').toLowerCase()}.`,
      type: 'support',
      priority: context.status === 'RESOLVED' ? 'HIGH' : 'MEDIUM',
      route: '/support',
    },
    emi_due_soon: {
      title: `${name}, EMI reminder`,
      message: `Your EMI of ${amount} is due ${context.dueLabel || 'soon'}. Pay on time to keep your account healthy.`,
      type: 'loan',
      priority: 'HIGH',
      route: context.loanId ? `/loan/${context.loanId}` : '/payments',
    },
    emi_overdue: {
      title: `${name}, EMI is overdue`,
      message: `Your EMI of ${amount} is overdue. Please pay from the app to avoid extra follow-up.`,
      type: 'loan',
      priority: 'HIGH',
      route: context.loanId ? `/loan/${context.loanId}` : '/payments',
    },
    kyc_profile_incomplete: {
      title: `${name}, complete your KYC`,
      message: 'Verify PAN, Aadhaar and upload documents to keep eligible services ready.',
      type: 'kyc',
      priority: 'MEDIUM',
      route: '/kyc',
    },
    kyc_pending_review: {
      title: `${name}, KYC is under review`,
      message: 'Your KYC request is with the Khatu Pay team. You will receive an update after review.',
      type: 'kyc',
      priority: 'LOW',
      route: '/kyc',
    },
    payment_pending: {
      title: `${name}, payment is still pending`,
      message: `Your ${paymentLabel(context.payment)} of ${amount} is pending. Check the latest status in payment history.`,
      type: 'payment',
      priority: 'MEDIUM',
      route: '/payment-history',
    },
    wallet_low: {
      title: `${name}, wallet balance is low`,
      message: `Your wallet balance is ${amount}. Add money before bill payments or recharge to avoid delays.`,
      type: 'payment',
      priority: 'LOW',
      route: '/payments',
    },
    push_test: {
      title: `${name}, notifications are ready`,
      message: 'KhatuPay push notifications are connected on this device.',
      type: 'general',
      priority: 'HIGH',
      route: '/notifications',
    },
  };

  return templates[event] || {
    title: `Hi ${name}, KhatuPay update`,
    message: context.message || 'You have a new update in your KhatuPay account.',
    type: 'general',
    priority: 'MEDIUM',
    route: '/notifications',
  };
}

export async function notifyUserSmart(userId, event, context = {}) {
  const user = await User.findById(userId).select('name email mobile fcmTokens notificationsEnabled');
  if (!user) return null;
  if (user.notificationsEnabled === false && context.force !== true) return null;

  const template = buildTemplate(event, user, context);
  const data = {
    ...(context.data || {}),
    event,
    route: context.route || template.route,
    screen: template.type,
    brand: BRAND.name,
    brandColor: BRAND.color,
    brandAccent: BRAND.accent,
    logoUrl: BRAND.logoUrl,
  };

  if (context.dedupeKey) {
    const existing = await Notification.findOne({
      userId: user._id,
      'data.dedupeKey': context.dedupeKey,
    }).select('_id');
    if (existing) return existing;
    data.dedupeKey = context.dedupeKey;
  }

  const notification = context.persist === false
    ? null
    : await Notification.create({
        userId: user._id,
        title: template.title,
        message: template.message,
        type: template.type,
        priority: template.priority,
        data,
      });

  const tokens = Array.isArray(user.fcmTokens) ? user.fcmTokens.filter(Boolean) : [];
  const channelResult = { fcmSent: 0, fcmFailed: 0, emailSent: false, emailFailed: false };
  const invalidTokens = [];
  for (const token of tokens.slice(0, 5)) {
    const result = await sendFCMToTokenDetailed(
      token,
      { title: template.title, body: template.message },
      data
    );
    if (result.invalid) invalidTokens.push(token);
    if (result.success) channelResult.fcmSent += 1;
    else channelResult.fcmFailed += 1;
  }

  if (invalidTokens.length) {
    await User.updateOne(
      { _id: user._id },
      { $pull: { fcmTokens: { $in: invalidTokens } } }
    );
  }

  if (user.email && shouldSendEmail(event, context)) {
    try {
      await sendMail(
        user.email,
        template.title,
        buildEmailHtml(template, user, context),
        `${template.title}\n\n${template.message}`
      );
      channelResult.emailSent = true;
    } catch (error) {
      channelResult.emailFailed = true;
      console.error('Smart notification email failed:', error.message);
    }
  }

  if (notification) {
    notification.data = { ...(notification.data || {}), channels: channelResult };
    await notification.save();
  }

  return notification;
}

export function buildSmartNotificationPreview(event, user, context = {}) {
  return buildTemplate(event, user, context);
}
