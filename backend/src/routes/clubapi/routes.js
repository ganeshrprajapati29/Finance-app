import express from 'express';
const router = express.Router();
import ClubAPIController from './controllers.js';
import { handleClubAPIError } from './errorHandler.js';
import { requireAuth } from '../../middlewares/auth.js';

// Bill Fetch
router.post('/bill/fetch', requireAuth, ClubAPIController.fetchBill);

// Bill Payment
router.post('/bill/pay', requireAuth, ClubAPIController.payBill);

// Recharge
router.post('/recharge', requireAuth, ClubAPIController.recharge);

// Transaction Status
router.get('/transaction/:urid/status', requireAuth, ClubAPIController.getTransactionStatus);

// Transaction History
router.get('/transactions', requireAuth, ClubAPIController.getTransactionHistory);

// Error handling middleware
router.use(handleClubAPIError);

export default router;
