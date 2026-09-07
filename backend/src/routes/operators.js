import express from 'express';
const router = express.Router();
import apiClient from '../utils/apiClient.js';

// Fetch Mobile Operators
router.get('/operators/mobile', async (req, res) => {
  try {
    const result = await apiClient.makeRequest('/api/operators/mobile', {});
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Fetch operators error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mobile operators',
      error: error.message
    });
  }
});

// Fetch DTH Providers
router.get('/operators/dth', async (req, res) => {
  try {
    const result = await apiClient.makeRequest('/api/operators/dth', {});
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Fetch DTH providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DTH providers',
      error: error.message
    });
  }
});

export default router;
