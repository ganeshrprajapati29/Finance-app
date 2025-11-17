import { Router } from 'express';
import Joi from 'joi';
import { requireAuth } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { requireAdmin } from '../middlewares/adminAuth.js';
import Loan from '../models/Loan.js';
import Settlement from '../models/Settlement.js';
import LegalAction from '../models/LegalAction.js';
import User from '../models/User.js';
import { ok, fail } from '../utils/response.js';
import { sendMail } from '../services/mailer.js';
import { sendSMS } from '../services/sms.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// Get all loans for settlement
router.get('/loans/overdue', async (req, res, next) => {
  try {
    const allLoans = await Loan.find({})
    .populate('userId', 'name email mobile')
    .sort({ createdAt: -1 });

    const data = allLoans.map(loan => {
      // Calculate outstanding amount from schedule
      const outstandingAmount = loan.schedule.reduce((sum, s) => sum + (s.paid ? 0 : s.total), 0);

      return {
        _id: loan._id,
        userId: loan.userId,
        decision: loan.decision,
        outstandingAmount,
        status: loan.status,
        nextPaymentDate: loan.nextPaymentDate,
        lastPaymentDate: loan.lastPaymentDate,
        createdAt: loan.createdAt
      };
    });

    return ok(res, data);
  } catch (e) { next(e); }
});

// Get all loans for legal action (all users who have taken loans)
router.get('/loans/defaulted', async (req, res, next) => {
  try {
    const allLoans = await Loan.find({})
    .populate('userId', 'name email mobile')
    .sort({ createdAt: -1 });

    const data = allLoans.map(loan => {
      // Calculate outstanding amount from schedule
      const outstandingAmount = loan.schedule.reduce((sum, s) => sum + (s.paid ? 0 : s.total), 0);

      return {
        _id: loan._id,
        userId: loan.userId,
        decision: loan.decision,
        outstandingAmount,
        status: loan.status,
        nextPaymentDate: loan.nextPaymentDate,
        lastPaymentDate: loan.lastPaymentDate,
        createdAt: loan.createdAt
      };
    });

    return ok(res, data);
  } catch (e) { next(e); }
});

// Create settlement offer and close loan
router.post('/loans/:loanId/settlement', async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { settlementAmount, reason, notes } = await Joi.object({
      settlementAmount: Joi.number().positive().required(),
      reason: Joi.string().valid('financial_hardship', 'negotiation', 'legal_risk', 'goodwill', 'other').required(),
      notes: Joi.string().optional()
    }).validateAsync(req.body);

    // Get loan details
    const loan = await Loan.findById(loanId).populate('userId', 'name email mobile');
    if (!loan) {
      return fail(res, 'LOAN_NOT_FOUND', 'Loan not found', 404);
    }

    if (loan.status === 'CLOSED') {
      return fail(res, 'LOAN_CLOSED', 'Loan is already closed', 400);
    }

    // Calculate outstanding amount from schedule
    const originalOutstanding = loan.schedule.reduce((sum, s) => sum + (s.paid ? 0 : s.total), 0);

    // Create settlement
    const settlement = new Settlement({
      loanId,
      userId: loan.userId._id,
      settlementAmount,
      originalOutstanding,
      reason,
      notes,
      offeredBy: req.admin.id,
      status: 'accepted'
    });

    await settlement.save();

    // Update loan status to closed
    loan.status = 'CLOSED';
    loan.outstandingAmount = 0;
    loan.closedAt = new Date();
    loan.closedBy = req.admin.id;
    loan.closureReason = 'settlement';
    await loan.save();

    // Send notification to user
    const subject = 'Loan Settlement Completed - Khatu Pay';
    const htmlMessage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loan Settlement Completed - Khatu Pay</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f8f9fa;
        }
        .container {
            background-color: #ffffff;
            margin: 20px;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #6c757d;
            font-size: 16px;
        }
        .success-icon {
            color: #28a745;
            font-size: 48px;
            margin-bottom: 20px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
        }
        .details-card {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: 600;
            color: #495057;
        }
        .detail-value {
            font-weight: 700;
            color: #007bff;
        }
        .savings-highlight {
            background-color: #d4edda;
            color: #155724;
            padding: 10px;
            border-radius: 5px;
            margin: 15px 0;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            text-align: center;
            color: #6c757d;
        }
        .contact-info {
            background-color: #e7f3ff;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .highlight-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">KHATU PAY</div>
            <div class="subtitle">Your Trusted Financial Partner</div>
        </div>

        <div style="text-align: center;">
            <div class="success-icon">✓</div>
        </div>

        <div class="greeting">
            Dear ${loan.userId.name},
        </div>

        <div class="highlight-box">
            <h3 style="margin: 0; color: white;">🎉 Loan Settlement Completed Successfully!</h3>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your loan account has been settled and closed</p>
        </div>

        <div class="details-card">
            <h4 style="margin-top: 0; color: #007bff;">Settlement Details</h4>

            <div class="detail-row">
                <span class="detail-label">Original Outstanding Amount:</span>
                <span class="detail-value">₹${settlement.originalOutstanding.toLocaleString()}</span>
            </div>

            <div class="detail-row">
                <span class="detail-label">Settlement Amount Paid:</span>
                <span class="detail-value">₹${settlementAmount.toLocaleString()}</span>
            </div>

            <div class="detail-row">
                <span class="detail-label">Settlement Reason:</span>
                <span class="detail-value">${reason.replace('_', ' ').toUpperCase()}</span>
            </div>
        </div>

        <div class="savings-highlight">
            💰 You saved: ₹${(settlement.originalOutstanding - settlementAmount).toLocaleString()}
        </div>

        <div class="contact-info">
            <h5 style="margin-top: 0; color: #007bff;">What happens next?</h5>
            <p style="margin-bottom: 0;">
                Your loan account is now permanently closed. No further payments are required.
                Thank you for choosing Khatu Pay for your financial needs.
            </p>
        </div>

        <div class="footer">
            <p style="margin-bottom: 10px;">
                <strong>Need assistance?</strong><br>
                Contact our support team at support@khatupay.com or call us at +91-XXXXXXXXXX
            </p>
            <p style="margin-bottom: 0; font-size: 14px;">
                This is an automated message from Khatu Pay.<br>
                Please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
    `;

    // Send email notification
    try {
      await sendMail(loan.userId.email, subject, htmlMessage);
    } catch (emailError) {
      console.error('Failed to send settlement email:', emailError);
    }

    // Send SMS notification
    try {
      await sendSMS(loan.userId.mobile, `Khatu Pay: Your loan has been settled for ₹${settlementAmount}. Account closed. Thank you!`);
    } catch (smsError) {
      console.error('Failed to send settlement SMS:', smsError);
    }

    return ok(res, { settlement, loan });
  } catch (e) { next(e); }
});

// Get all settlements
router.get('/settlements', async (req, res, next) => {
  try {
    const settlements = await Settlement.find()
      .populate('loanId', 'outstandingAmount status')
      .populate('userId', 'name email mobile')
      .populate('offeredBy', 'name')
      .sort({ createdAt: -1 });

    return ok(res, settlements);
  } catch (e) { next(e); }
});

// Initiate legal action
router.post('/loans/:loanId/legal-action', async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { actionType, noticeType, message, sendEmail, sendSMS, language } = await Joi.object({
      actionType: Joi.string().valid('warning_notice', 'legal_notice', 'court_notice').required(),
      noticeType: Joi.string().valid('warning', 'formal', 'court').default('warning'),
      message: Joi.string().required(),
      sendEmail: Joi.boolean().default(true),
      sendSMS: Joi.boolean().default(true),
      language: Joi.string().valid('english', 'hindi').default('english')
    }).validateAsync(req.body);

    // Get loan details
    const loan = await Loan.findById(loanId).populate('userId', 'name email mobile');
    if (!loan) {
      return fail(res, 'LOAN_NOT_FOUND', 'Loan not found', 404);
    }

    // Create legal action record
    const legalAction = new LegalAction({
      loanId,
      userId: loan.userId._id,
      actionType,
      noticeType,
      message,
      language,
      sendEmail,
      sendSMS,
      initiatedBy: req.admin.id
    });

    await legalAction.save();

    // Send notifications
    if (sendEmail) {
      try {
        const subject = getEmailSubject(actionType, language);
        await sendMail(loan.userId.email, subject, message);
        legalAction.emailSent = true;
        legalAction.emailSentAt = new Date();
      } catch (emailError) {
        console.error('Failed to send legal action email:', emailError);
      }
    }

    if (sendSMS) {
      try {
        const smsMessage = getSMSMessage(actionType, language, loan.outstandingAmount);
        await sendSMS(loan.userId.mobile, smsMessage);
        legalAction.smsSent = true;
        legalAction.smsSentAt = new Date();
      } catch (smsError) {
        console.error('Failed to send legal action SMS:', smsError);
      }
    }

    legalAction.status = 'sent';
    await legalAction.save();

    return ok(res, legalAction);
  } catch (e) { next(e); }
});

// Get all legal actions
router.get('/legal-actions', async (req, res, next) => {
  try {
    const legalActions = await LegalAction.find()
      .populate('loanId', 'outstandingAmount status')
      .populate('userId', 'name email mobile')
      .populate('initiatedBy', 'name')
      .sort({ createdAt: -1 });

    return ok(res, legalActions);
  } catch (e) { next(e); }
});

// Helper functions for notifications
function getEmailSubject(actionType, language) {
  const subjects = {
    english: {
      warning_notice: 'Warning Notice - Khatu Pay',
      legal_notice: 'Legal Notice - Khatu Pay',
      court_notice: 'Court Notice - Khatu Pay'
    },
    hindi: {
      warning_notice: 'चेतावनी नोटिस - खातु पे',
      legal_notice: 'कानूनी नोटिस - खातु पे',
      court_notice: 'कोर्ट नोटिस - खातु पे'
    }
  };
  return subjects[language]?.[actionType] || 'Notice - Khatu Pay';
}

function getSMSMessage(actionType, language, amount) {
  const messages = {
    english: {
      warning_notice: `Khatu Pay: Warning notice sent for outstanding amount ₹${amount}. Please clear dues immediately.`,
      legal_notice: `Khatu Pay: Legal notice issued for outstanding amount ₹${amount}. Contact us to resolve.`,
      court_notice: `Khatu Pay: Court proceedings initiated for outstanding amount ₹${amount}.`
    },
    hindi: {
      warning_notice: `खातु पे: बकाया राशि ₹${amount} के लिए चेतावनी नोटिस भेजा गया है। कृपया तुरंत राशि चुकाएं।`,
      legal_notice: `खातु पे: बकाया राशि ₹${amount} के लिए कानूनी नोटिस जारी किया गया है। समाधान के लिए संपर्क करें।`,
      court_notice: `खातु पे: बकाया राशि ₹${amount} के लिए कोर्ट कार्यवाही शुरू की गई है।`
    }
  };
  return messages[language]?.[actionType] || `Khatu Pay: Notice sent for outstanding amount ₹${amount}`;
}

export default router;
