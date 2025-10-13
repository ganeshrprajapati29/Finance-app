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
import adminLoans from './routes/adminLoans.js';
import repayments from './routes/repayments.js';
import adminPush from './routes/adminPush.js';
import payments from './routes/payments.js';
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

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/loans', loanRoutes);
app.use('/payments', paymentRoutes);
app.use('/qr', qrRoutes);
app.use('/upload', uploadRoutes);
app.use('/admin', adminRoutes);
app.use('/faq', faqRoutes);
app.use('/bills', billRoutes);
app.use('/kyc', kycRoutes);
app.use('/support', supportRoutes);
app.use('/admin/loans', adminLoans);
app.use('/repayments', repayments);
app.use('/admin/push', adminPush);
app.use('/payments', payments);
app.use('/', baseRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Khatu Pay backend running http://localhost:${PORT}`));
