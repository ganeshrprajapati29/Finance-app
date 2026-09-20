import mongoose from 'mongoose';

/**
 * One ClubAPI call that matters to a customer: a bill fetch, a recharge or a
 * bill payment.
 *
 * This is the single schema for the collection. `routes/clubapi/models/
 * transaction.js` re-exports it; there used to be two diverging copies and
 * whichever file loaded first silently decided which fields were persisted.
 */
const clubAPITransactionSchema = new mongoose.Schema({
  urid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['bill_fetch', 'bill_payment', 'mobile', 'dth', 'other']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  /** operatorId (recharge) or bbpsId (bill). */
  provider: {
    type: String,
    required: true
  },
  accountRef: {
    type: String,
    required: true
  },
  billId: {
    type: String
  },
  customerMobile: {
    type: String
  },

  /** mobile | dth | credit_card | electricity | fastag */
  serviceKey: { type: String, index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider' },
  providerName: { type: String },

  /** ClubAPI's server-side order id - required for status checks. */
  orderId: { type: String, index: true },
  /** Operator / biller reference, shown to the customer as proof. */
  operatorTxnId: { type: String },
  /** Latest human-readable message from ClubAPI. */
  statusText: { type: String },

  /** Exact parameters sent to ClubAPI (never includes the token). */
  request: { type: mongoose.Schema.Types.Mixed },
  /** Normalised bill for a bill_fetch, and the amount rule it implies. */
  bill: { type: mongoose.Schema.Types.Mixed },
  amountRule: { type: mongoose.Schema.Types.Mixed },
  fetchExpiresAt: { type: Date },

  lastStatusCheckAt: { type: Date },
  statusChecks: { type: Number, default: 0 },
  completedAt: { type: Date },

  response: {
    type: mongoose.Schema.Types.Mixed
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  refund: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
clubAPITransactionSchema.index({ userId: 1, createdAt: -1 });
clubAPITransactionSchema.index({ status: 1 });
clubAPITransactionSchema.index({ type: 1 });
clubAPITransactionSchema.index({ status: 1, createdAt: 1 });

// Prevent OverwriteModelError during hot reloads (nodemon)
export default mongoose.models.ClubAPITransaction || mongoose.model('ClubAPITransaction', clubAPITransactionSchema);
