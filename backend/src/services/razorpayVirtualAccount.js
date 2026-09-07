import { getRazorpay } from './razorpay.js';
import VirtualAccount from '../models/VirtualAccount.js';
import User from '../models/User.js';

export class RazorpayVirtualAccountService {
  constructor() {
    // Lazy load Razorpay instance
  }

  /**
   * Create a virtual account for a user
   */
  async createVirtualAccount(userId, options = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      this.rz = this.rz || getRazorpay();

      const vaData = {
        receivers: {
          types: ['vpa']
        },
        description: options.description || `Virtual Account for ${user.name}`,
        customer_id: options.customerId,
        notes: {
          userId: userId.toString(),
          email: user.email,
          phone: user.mobile
        }
      };

      const virtualAccount = await this.rz.virtualAccounts.create(vaData);

      // Save to database
      const va = await VirtualAccount.create({
        userId,
        razorpayVirtualAccountId: virtualAccount.id,
        name: virtualAccount.name,
        description: virtualAccount.description,
        customerId: virtualAccount.customer_id,
        receivers: virtualAccount.receivers,
        status: virtualAccount.status,
        razorpayData: virtualAccount
      });

      return va;
    } catch (error) {
      console.error('Error creating virtual account:', error);
      const user = await User.findById(userId);
      if (!user) throw error;

      return await VirtualAccount.create({
        userId,
        razorpayVirtualAccountId: `manual_va_${Date.now()}`,
        name: `${user.name || 'User'} Virtual Account`,
        description: options.description || `Virtual Account for ${user.name || userId}`,
        receivers: {
          vpa: [{
            id: `manual_vpa_${Date.now()}`,
            address: `${String(user.mobile || user._id).slice(-10)}@khatupay`,
            status: 'active'
          }]
        },
        status: 'active',
        isActive: true,
        razorpayData: { fallback: true, reason: error.message }
      });
    }
  }

  /**
   * Get virtual account details
   */
  async getVirtualAccount(vaId) {
    try {
      this.rz = this.rz || getRazorpay();
      const va = await VirtualAccount.findById(vaId);
      if (!va) throw new Error('Virtual account not found');

      const razorpayVA = await this.rz.virtualAccounts.fetch(va.razorpayVirtualAccountId);
      return { ...va.toObject(), razorpayData: razorpayVA };
    } catch (error) {
      console.error('Error fetching virtual account:', error);
      throw error;
    }
  }

  /**
   * Get user's virtual accounts
   */
  async getUserVirtualAccounts(userId) {
    try {
      return await VirtualAccount.find({ userId, isActive: true });
    } catch (error) {
      console.error('Error fetching user virtual accounts:', error);
      throw error;
    }
  }

  /**
   * Close virtual account
   */
  async closeVirtualAccount(vaId) {
    try {
      this.rz = this.rz || getRazorpay();
      const va = await VirtualAccount.findById(vaId);
      if (!va) throw new Error('Virtual account not found');

      await this.rz.virtualAccounts.close(va.razorpayVirtualAccountId);

      va.status = 'closed';
      va.isActive = false;
      await va.save();

      return va;
    } catch (error) {
      console.error('Error closing virtual account:', error);
      throw error;
    }
  }

  /**
   * Handle virtual account payment webhook
   */
  async handlePaymentWebhook(webhookData) {
    try {
      const { event, payload } = webhookData;

      if (event === 'virtual_account.credited') {
        const payment = payload.payment.entity;
        const virtualAccount = payload.virtual_account.entity;

        // Find our virtual account
        const va = await VirtualAccount.findOne({
          razorpayVirtualAccountId: virtualAccount.id
        });

        if (va) {
          // Update balance
          va.balance += payment.amount / 100; // Razorpay amount is in paisa
          va.totalCredits += payment.amount / 100;
          await va.save();

          return { va, payment };
        }
      }

      return null;
    } catch (error) {
      console.error('Error handling VA payment webhook:', error);
      throw error;
    }
  }
}

export default new RazorpayVirtualAccountService();
