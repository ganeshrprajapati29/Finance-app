import FraudDetectionService from '../services/fraudDetection.js';
import { notifyUserSmart } from '../services/smartNotifications.js';

const fraudCheck = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.userId || req.userId || req.body?.userId;
    const { amount } = req.body;

    if (!amount) {
      return next();
    }

    const fraudResult = await FraudDetectionService.checkTransaction(
      userId,
      { amount },
      req.transactionType || 'Payment'
    );

    req.fraudResult = fraudResult;

    if (fraudResult.isFraudulent) {
      console.warn(`Suspicious transaction detected${userId ? ` for user ${userId}` : ''}:`, {
        amount,
        riskScore: fraudResult.riskScore,
        alerts: fraudResult.alerts.length,
      });

      req.isFlaggedForFraud = true;

      if (userId) {
        notifyUserSmart(userId, 'security_alert', {
          force: true,
          email: true,
          message: 'We noticed unusual activity during a transaction attempt. Please review your account activity.',
          amount,
          route: '/payment-history',
          dedupeKey: `fraud:${userId}:${Date.now()}`,
          data: {
            amount,
            riskScore: fraudResult.riskScore,
            alerts: fraudResult.alerts,
            transactionType: req.transactionType || 'Payment',
          },
        }).catch((error) => console.error('Fraud alert notification failed:', error.message));
      }
    }

    next();
  } catch (error) {
    console.error('Fraud check middleware error:', error.message);
    next();
  }
};

export default fraudCheck;
