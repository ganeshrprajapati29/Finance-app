import express from 'express';
const router = express.Router();
import apiClient from '../utils/apiClient.js';
import Transaction from '../models/Transaction.js';

// DTH Recharge
router.post('/dth/recharge', async (req, res) => {
  try {
    const { urid, operatorId, mobile, amount, cbId, customerMobile, opvalue1, opvalue2, opvalue3 } = req.body;

    // Validate required fields
    if (!urid || !operatorId || !mobile || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: urid, operatorId, mobile, amount'
      });
    }

    // Create transaction record
    const transaction = new Transaction({
      urid,
      operatorId,
      mobile,
      amount,
      transactionType: 'dth',
      customerMobile,
      opvalue1,
      opvalue2,
      opvalue3
    });

    await transaction.save();

    // Make API call to ClubAPI
    const apiData = {
      urid,
      operatorId,
      mobile,
      amount: amount.toString(),
      ...(cbId && { cbId }),
      ...(customerMobile && { customerMobile }),
      ...(opvalue1 && { opvalue1 }),
      ...(opvalue2 && { opvalue2 }),
      ...(opvalue3 && { opvalue3 })
    };

    const result = await apiClient.makeRequest('/api/dth/recharge', apiData);

    // Update transaction with API response
    transaction.clubapiResponse = result;
    transaction.status = result.status || 'processing';
    await transaction.save();

    res.json({
      success: true,
      message: 'DTH recharge initiated successfully',
      data: result,
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('DTH recharge error:', error);
    res.status(500).json({
      success: false,
      message: 'DTH recharge failed',
      error: error.message
    });
  }
});

export default router;
