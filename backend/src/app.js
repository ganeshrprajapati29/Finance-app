import express from 'express';
import dotenv from 'dotenv';
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

// ClubAPI
import rechargeRoutes from './routes/recharge.js';
import dthRoutes from './routes/dth.js';
import operatorsRoutes from './routes/operators.js';
import bbpsRoutes from './routes/bbps.js';
import statusRoutes from './routes/status.js';
import clubapiRoutes from './routes/clubapi/routes.js';
import utilityRoutes from './routes/utility.js';
import callbackRoutes from './routes/callback.js';
import { setRealtime } from './realtime.js';

dotenv.config();

const app = express();
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

app.use(express.json({ limit: "10mb" }));
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
app.use("/api/admin/push", adminPush);

// Club APIs
app.use("/api/recharge", rechargeRoutes);
app.use("/api/dth", dthRoutes);
app.use("/api/operators", operatorsRoutes);
app.use("/api/bbps", bbpsRoutes);
app.use("/api/status", statusRoutes);
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
