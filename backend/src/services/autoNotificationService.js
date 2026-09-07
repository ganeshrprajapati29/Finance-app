import Loan from '../models/Loan.js';
import Notification from '../models/Notification.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { notifyUserSmart } from './smartNotifications.js';

const DAY_MS = 24 * 60 * 60 * 1000;
let timer = null;
let running = false;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - start) / DAY_MS + start.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(date, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((target - start) / DAY_MS);
}

function kycStatus(user) {
  return String(user.kyc?.status || 'PENDING').toUpperCase();
}

function hasKycDocs(user) {
  const docs = user.kyc?.docs || user.kyc?.documents || [];
  return Array.isArray(docs) && docs.length > 0;
}

async function notify(userId, event, context, dryRun, generated) {
  generated.push({ userId: String(userId), event, title: context.title, dedupeKey: context.dedupeKey });
  if (dryRun) return null;
  return notifyUserSmart(userId, event, context);
}

async function generateForUser(user, options, generated) {
  const now = options.now || new Date();
  const today = dayKey(now);
  const weekly = weekKey(now);
  const uid = user._id;

  const status = kycStatus(user);
  const panOk = user.kyc?.panVerified === true;
  const aadhaarOk = user.kyc?.aadhaarVerified === true;
  const docsOk = hasKycDocs(user);

  if (status === 'PENDING' && (!panOk || !aadhaarOk || !docsOk)) {
    await notify(uid, 'kyc_profile_incomplete', {
      dedupeKey: `kyc-incomplete:${uid}:${weekly}`,
    }, options.dryRun, generated);
  }

  if (status === 'SUBMITTED') {
    await notify(uid, 'kyc_pending_review', {
      dedupeKey: `kyc-review:${uid}:${today}`,
    }, options.dryRun, generated);
  }

  if (Number(user.walletBalance || 0) > 0 && Number(user.walletBalance || 0) < 50) {
    await notify(uid, 'wallet_low', {
      amount: user.walletBalance,
      dedupeKey: `wallet-low:${uid}:${weekly}`,
    }, options.dryRun, generated);
  }

  const loans = await Loan.find({
    userId: uid,
    status: { $in: ['DISBURSED'] },
    'schedule.paid': { $ne: true },
  }).select('loanAccountNumber schedule status');

  for (const loan of loans) {
    const pending = (loan.schedule || [])
      .filter((emi) => emi && emi.paid !== true && toDate(emi.dueDate))
      .sort((a, b) => toDate(a.dueDate) - toDate(b.dueDate));

    for (const emi of pending.slice(0, 3)) {
      const due = toDate(emi.dueDate);
      const diff = daysUntil(due, now);
      const amount = emi.total || emi.amount || 0;
      const base = `${uid}:${loan._id}:${emi.installmentNo}:${today}`;

      if (diff < 0) {
        await notify(uid, 'emi_overdue', {
          amount,
          loanId: String(loan._id),
          loanAccountNumber: loan.loanAccountNumber,
          dedupeKey: `emi-overdue:${base}`,
        }, options.dryRun, generated);
      } else if ([0, 1, 3].includes(diff)) {
        await notify(uid, 'emi_due_soon', {
          amount,
          dueLabel: diff === 0 ? 'today' : `in ${diff} day${diff === 1 ? '' : 's'}`,
          loanId: String(loan._id),
          loanAccountNumber: loan.loanAccountNumber,
          dedupeKey: `emi-due:${base}`,
        }, options.dryRun, generated);
      }
    }
  }

  const pendingPayments = await Payment.find({
    userId: uid,
    status: 'PENDING',
    createdAt: { $gte: new Date(now.getTime() - 2 * DAY_MS) },
  }).select('type amount status createdAt khatuPaymentId');

  for (const payment of pendingPayments.slice(0, 3)) {
    const ageMinutes = (now - payment.createdAt) / (60 * 1000);
    if (ageMinutes < 10) continue;
    await notify(uid, 'payment_pending', {
      amount: payment.amount,
      payment,
      dedupeKey: `payment-pending:${payment._id}:${today}`,
    }, options.dryRun, generated);
  }
}

export async function runSmartNotificationScan(options = {}) {
  if (running) return { skipped: true, reason: 'scan_already_running' };
  running = true;
  const generated = [];
  try {
    const query = {
      status: 'active',
      notificationsEnabled: { $ne: false },
      ...(options.userId ? { _id: options.userId } : {}),
    };
    const users = await User.find(query)
      .select('name mobile walletBalance kyc notificationsEnabled fcmTokens')
      .limit(options.limit || 500);

    for (const user of users) {
      await generateForUser(user, options, generated);
    }

    return {
      scannedUsers: users.length,
      generatedCount: generated.length,
      generated,
    };
  } finally {
    running = false;
  }
}

export function startAutoNotificationScheduler() {
  if (timer || process.env.AUTO_NOTIFICATIONS_ENABLED === 'false') return;
  const intervalMs = Number(process.env.AUTO_NOTIFICATIONS_INTERVAL_MS || 60 * 60 * 1000);
  timer = setInterval(() => {
    runSmartNotificationScan().catch((error) => {
      console.error('Auto notification scan failed:', error.message);
    });
  }, intervalMs);
  timer.unref?.();
  setTimeout(() => {
    runSmartNotificationScan().catch((error) => {
      console.error('Initial auto notification scan failed:', error.message);
    });
  }, 30 * 1000).unref?.();
}

export async function unreadSummary(userId) {
  const [unread, high] = await Promise.all([
    Notification.countDocuments({ userId, isRead: false }),
    Notification.countDocuments({ userId, isRead: false, priority: 'HIGH' }),
  ]);
  return { unread, highPriority: high };
}
