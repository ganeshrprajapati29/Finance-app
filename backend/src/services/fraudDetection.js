import Payment from '../models/Payment.js';
import mongoose from 'mongoose';

const HIGH_VALUE_AMOUNT = Number(process.env.FRAUD_HIGH_VALUE_AMOUNT || 10000);
const DAILY_AMOUNT_LIMIT = Number(process.env.FRAUD_DAILY_AMOUNT_LIMIT || 25000);
const DAILY_COUNT_LIMIT = Number(process.env.FRAUD_DAILY_COUNT_LIMIT || 8);

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addAlert(alerts, code, message, score) {
  alerts.push({ code, message, score });
}

async function checkTransaction(userId, payload = {}, transactionType = 'Payment') {
  const amount = Number(payload.amount || 0);
  const alerts = [];
  let riskScore = 0;

  if (!amount || amount < 0) {
    addAlert(alerts, 'INVALID_AMOUNT', 'Invalid transaction amount detected', 40);
  }

  if (amount >= HIGH_VALUE_AMOUNT) {
    addAlert(alerts, 'HIGH_VALUE', `High value ${transactionType.toLowerCase()} detected`, 35);
  }

  if (userId) {
    const today = startOfDay();
    const dbUserId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;
    const stats = await Payment.aggregate([
      {
        $match: {
          userId: dbUserId,
          createdAt: { $gte: today },
          status: { $in: ['PENDING', 'SUCCESS', 'COMPLETED'] },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);
    const daily = stats[0] || { count: 0, totalAmount: 0 };

    if (daily.count >= DAILY_COUNT_LIMIT) {
      addAlert(alerts, 'DAILY_COUNT_LIMIT', 'Multiple transactions detected today', 25);
    }
    if (Number(daily.totalAmount || 0) + amount >= DAILY_AMOUNT_LIMIT) {
      addAlert(alerts, 'DAILY_AMOUNT_LIMIT', 'Daily transaction amount is unusually high', 35);
    }
  }

  riskScore = alerts.reduce((sum, alert) => sum + alert.score, 0);
  return {
    riskScore,
    alerts,
    isFraudulent: riskScore >= 60,
    shouldReview: riskScore >= 35,
  };
}

export default { checkTransaction };
