import express from 'express';
const router = express.Router();
import apiClient from '../utils/apiClient.js';
import Transaction from '../models/Transaction.js';

// Recharge Status Check
router.post('/status/recharge', async (req, res) => {
  try {
    const { urid } = req.body;

    if (!urid) {
      return res.status(400).json({
        success: false,
        message: 'urid is required'
      });
    }

    const result = await apiClient.makeRequest('/api/status/recharge', { urid });

    // Update local transaction status if needed
    await Transaction.findOneAndUpdate(
      { urid },
      { 
        clubapiResponse: result,
        status: result.status || 'processing',
        updatedAt: new Date()
      }
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Status check failed',
      error: error.message
    });
  }
});

// Callback URL for ClubAPI
router.post('/callback/recharge', async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('Received callback from ClubAPI:', callbackData);

    // Update transaction based on callback
    if (callbackData.urid) {
      await Transaction.findOneAndUpdate(
        { urid: callbackData.urid },
        {
          clubapiResponse: callbackData,
          status: callbackData.status || 'processing',
          updatedAt: new Date()
        }
      );
    }

    // Always return success to ClubAPI
    res.json({ success: true, message: 'Callback received successfully' });

  } catch (error) {
    console.error('Callback processing error:', error);
    res.json({ success: false, message: 'Callback processing failed' });
  }
});

export default router;
