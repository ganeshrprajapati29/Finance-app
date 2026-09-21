import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

// DB
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

// Middlewares
import { notFound, errorHandler } from './middlewares/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import baseRoutes from './routes/index.js';
import userRoutes from './routes/users.js';
import loanRoutes from './routes/loans.js';
import paymentRoutes from './routes/payments.js';
import paymentChatRoutes from './routes/paymentChat.js';
import virtualCardRoutes from './routes/virtualCards.js';
import qrRoutes from './routes/qr.js';
import uploadRoutes from './routes/upload.js';
import adminRoutes from './routes/admin.js';
import faqRoutes from './routes/faq.js';
import billRoutes from './routes/bills.js';
import offerRoutes from './routes/offers.js';
import rewardRoutes from './routes/rewards.js';
import invoiceRoutes from './routes/invoices.js';
import kycRoutes from './routes/kyc.js';
import supportRoutes from './routes/support.js';
import employeeAuthRoutes from './routes/employeeAuth.js';
import employeeRoutes from './routes/employees.js';
import employeePanelRoutes from './routes/employee.js';
import adminLoans from './routes/adminLoans.js';
import repayments from './routes/repayments.js';
import adminPush from './routes/adminPush.js';
import notifications from './routes/notifications.js';
import withdrawalRoutes from './routes/withdrawals.js';
import adminWithdrawalRoutes from './routes/adminWithdrawals.js';
import reportsRoutes from './routes/reports.js';
import adminSettlementsRoutes from './routes/adminSettlements.js';
import adminTrackLoanRoutes from './routes/adminTrackLoan.js';
import adminNotifications from './routes/adminNotifications.js';
import adminEmiControl from './routes/adminEmiControl.js';
import adminCollections from './routes/adminCollections.js';
import agents from './routes/agents.js';
import adminVirtualAccounts from './routes/adminVirtualAccounts.js';
import adminVirtualCards from './routes/adminVirtualCards.js';
import adminPayouts from './routes/adminPayouts.js';
import adminQR from './routes/adminQR.js';
import qrStickerOrders from './routes/qrStickerOrders.js';
import adminQRStickerOrders from './routes/adminQRStickerOrders.js';
import adminEarnings from './routes/adminEarnings.js';
import adminInvoices from './routes/adminInvoices.js';
import adminOffers from './routes/adminOffers.js';
import adminRewards from './routes/adminRewards.js';
import adminClubAPI from './routes/adminClubAPI.js';
import loanVerificationRoutes from './routes/loanVerification.js';
import signcareWebhookRoutes from './routes/signcareWebhook.js';
import upiConsumerRoutes from './routes/upiConsumer.js';
import merchantBusinessRoutes from './routes/merchantBusiness.js';
import merchantQrRoutes from './routes/merchantQr.js';
import merchantPaymentsRoutes from './routes/merchantPayments.js';
import merchantSettlementsRoutes from './routes/merchantSettlements.js';
import velxapayWebhookRoutes from './routes/velxapayWebhook.js';
import adminMerchantBusinessesRoutes from './routes/adminMerchantBusinesses.js';
import { startMerchantSettlementJob } from './jobs/merchantSettlementJob.js';
import { startMerchantPaymentReconciliationJob } from './jobs/paymentReconciliationJob.js';

// ClubAPI
import rechargeRoutes from './routes/recharge.js';
import dthRoutes from './routes/dth.js';
import operatorsRoutes from './routes/operators.js';
import bbpsRoutes from './routes/bbps.js';
import statusRoutes from './routes/status.js';
import clubapiRoutes from './routes/clubapi/routes.js';
import utilityRoutes from './routes/utility.js';
import callbackRoutes from './routes/callback.js';
import serviceRoutes from './routes/services.js';
import adminServiceRoutes from './routes/adminServices.js';
import { startServiceReconciler } from './services/rechargePaymentService.js';
import { setRealtime } from './realtime.js';
import { missingRazorpayEnv } from './services/razorpay.js';
import { startAutoNotificationScheduler } from './services/autoNotificationService.js';

/* =======================
   ENV SANITY CHECK
======================= */
// Fail loudly at boot rather than at the first payment. Only variable *names*
// are printed - never values - so this is safe in any log aggregator.
{
  const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missingCritical = required.filter((k) => !String(process.env[k] || '').trim());
  if (missingCritical.length) {
    console.error(
      `FATAL: missing required environment variables: ${missingCritical.join(', ')}`
    );
    process.exit(1);
  }

  const missingPayments = missingRazorpayEnv({ requireWebhook: true });
  if (missingPayments.length) {
    console.warn(
      `WARNING: Razorpay is not fully configured (${missingPayments.join(', ')}). ` +
        'Payment endpoints will return 503 until these are set.'
    );
  }
}

const app = express();
// This app runs behind a reverse proxy in production, which sets
// X-Forwarded-For. Without this, express-rate-limit cannot safely resolve
// each caller's real IP and throws on every rate-limited request (this was
// silently breaking login/register/OTP rate limiting - see the `validate`
// option on each limiter for the defensive second half of this fix).
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

setRealtime(io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('NO_TOKEN'));
    socket.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
});

io.on('connection', (socket) => {
  if (socket.user?.uid) socket.join(`user:${socket.user.uid}`);
  socket.on('payment_chat:join', (threadId) => {
    if (threadId) socket.join(`thread:${threadId}`);
  });
});

/* =======================
   MIDDLEWARES
======================= */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Razorpay signs the exact bytes it sends, so the webhook route needs the raw
// body - re-serialising the parsed object would change key order/whitespace
// and every signature check would fail. `startsWith` (not ===) so an appended
// query string cannot silently skip the capture.
const RAZORPAY_WEBHOOK_PATH = '/api/payments/razorpay/webhook';
const VELXAPAY_WEBHOOK_PATH = '/api/webhooks/velxapay';
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    if ([RAZORPAY_WEBHOOK_PATH, VELXAPAY_WEBHOOK_PATH].includes((req.originalUrl || '').split('?')[0])) {
      req.rawBody = Buffer.from(buf);
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

/* =======================
   STATIC FILES
======================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =======================
   DATABASE CONNECT
======================= */
(async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
})();

/* =======================
   ROOT ENDPOINT
======================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Khatu Pay Backend API",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

/* =======================
   HEALTH CHECK
======================= */
app.get("/health", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const statusCode = dbStatus === "connected" ? 200 : 503;

  res.status(statusCode).json({
    success: dbStatus === "connected",
    message:
      dbStatus === "connected"
        ? "Backend is running successfully ✅"
        : "Database not connected",
    environment: process.env.NODE_ENV || "production",
    database: dbStatus,
    uptime: `${process.uptime().toFixed(2)} seconds`,
    timestamp: new Date().toISOString(),
  });
});

/* =======================
   SIMPLE CHECK
======================= */
app.get("/res", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running successfully ✅",
    environment: process.env.NODE_ENV || "production",
    uptime: `${process.uptime().toFixed(2)} seconds`,
    timestamp: new Date().toISOString(),
  });
});

/* =======================
   API ROUTES
======================= */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payment-chat", paymentChatRoutes);
app.use("/api/virtual-cards", virtualCardRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/qr-sticker-orders", qrStickerOrders);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/loans", adminLoans);
app.use("/api/admin/withdrawals", adminWithdrawalRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/employee/auth", employeeAuthRoutes);
app.use("/api/employee", employeePanelRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/repayments", repayments);
app.use("/api/notifications", notifications);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin/settlements", adminSettlementsRoutes);
app.use("/api/admin/track-loan", adminTrackLoanRoutes);
app.use("/api/admin/notifications", adminNotifications);
app.use("/api/admin/emi-control", adminEmiControl);
app.use("/api/admin/collections", adminCollections);
app.use("/api/agents", agents);
app.use("/api/admin/virtual-accounts", adminVirtualAccounts);
app.use("/api/admin/virtual-cards", adminVirtualCards);
app.use("/api/admin/payouts", adminPayouts);
app.use("/api/admin/qr", adminQR);
app.use("/api/admin/qr-sticker-orders", adminQRStickerOrders);
app.use("/api/admin/invoices", adminInvoices);
app.use("/api/admin/offers", adminOffers);
app.use("/api/admin/rewards", adminRewards);
app.use("/api/admin/earnings", adminEarnings);
app.use("/api/admin/clubapi", adminClubAPI);
app.use('/api/merchant-business', merchantBusinessRoutes);
app.use('/api/merchant-qr', merchantQrRoutes);
app.use('/api/merchant-payments', merchantPaymentsRoutes);
app.use('/api/merchant-settlements', merchantSettlementsRoutes);
app.use('/api/webhooks/velxapay', velxapayWebhookRoutes);
app.use('/api/admin/merchant-businesses', adminMerchantBusinessesRoutes);
app.use("/api/admin/services", adminServiceRoutes);
app.use("/api/admin/push", adminPush);
// SignCare is the only loan verification provider. The legacy credit-report
// route is intentionally no longer mounted.
app.use("/api/loan-verification", loanVerificationRoutes);
app.use("/api/signcare/webhook", signcareWebhookRoutes);
app.use("/api/upi-consumer", upiConsumerRoutes);

// Club APIs
app.use("/api/recharge", rechargeRoutes);
app.use("/api/dth", dthRoutes);
app.use("/api/operators", operatorsRoutes);
app.use("/api/bbps", bbpsRoutes);
app.use("/api/status", statusRoutes);
// Recharge & bill services (Mobile, DTH, Credit Card, Electricity, FASTag)
app.use("/api/services", serviceRoutes);
app.use("/api/clubapi", clubapiRoutes);
app.use("/api/utility", utilityRoutes);
app.use("/api/callback", callbackRoutes);

// Base route
app.use("/api", baseRoutes);

/* =======================
   ERROR HANDLERS
======================= */
app.use(notFound);
app.use(errorHandler);

/* =======================
   SERVER START
======================= */

// 🔥 FIX: Force ONLY port 3000
const PORT = Number(process.env.PORT) || 5005;

server.listen(PORT, () => {
  startAutoNotificationScheduler();
  // Resolves recharges / bill payments left pending by timeouts or missed callbacks.
  startServiceReconciler();
  startMerchantSettlementJob();
  startMerchantPaymentReconciliationJob();
  console.log(`
🚀 Backend Server Started
🌐 Port: ${PORT}
📁 Uploads: /uploads
🔍 Health Check: /health, /res
🏠 Root: /
⏱️ Time: ${new Date().toLocaleString()}
----------------------------------
`);
});
