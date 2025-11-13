import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.js';
import baseRoutes from './routes/index.js';
import loanRoutes from './routes/loans.js';
import paymentRoutes from './routes/payments.js';
import qrRoutes from './routes/qr.js';
import uploadRoutes from './routes/upload.js';
import adminRoutes from './routes/admin.js';
import faqRoutes from './routes/faq.js';
import billRoutes from './routes/bills.js';
import userRoutes from './routes/users.js';
import kycRoutes from './routes/kyc.js';
import supportRoutes from './routes/support.js';
import employeeAuthRoutes from './routes/employeeAuth.js';
import employeeRoutes from './routes/employees.js';
import adminLoans from './routes/adminLoans.js';
import repayments from './routes/repayments.js';
import adminPush from './routes/adminPush.js';
import payments from './routes/payments.js';
import notifications from './routes/notifications.js';
import withdrawalRoutes from './routes/withdrawals.js';
import adminWithdrawalRoutes from './routes/adminWithdrawals.js';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

await connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/loans', adminLoans);
app.use('/api/admin/withdrawals', adminWithdrawalRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/employee/auth', employeeAuthRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/repayments', repayments);
app.use('/api/payments', payments);
app.use('/api/notifications', notifications);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api', baseRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Khatu Pay backend running http://localhost:${PORT}`));
