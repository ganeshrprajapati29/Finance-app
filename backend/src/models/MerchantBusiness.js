import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  publicId: { type: String, required: true, unique: true, index: true },
  businessName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  mobile: { type: String, required: true }, email: String, address: String,
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED'], default: 'DRAFT', index: true },
  rejectionReason: String,
  // What the owner submitted for payment activation. Kept so the application
  // can be (re)sent to Razorpay without asking the owner to type it again.
  onboardingRequest: mongoose.Schema.Types.Mixed,
  razorpay: {
    // NOT_STARTED | QUEUED (waiting for provider access) | SUBMITTED
    providerState: String, lastProviderError: String, queuedAt: Date, settlementConfiguredAt: Date,
    accountId: { type: String, index: true }, stakeholderId: String, productId: String,
    accountStatus: String, productStatus: String, requirements: mongoose.Schema.Types.Mixed,
    productConfiguration: mongoose.Schema.Types.Mixed,
    documentUploads: [{
      documentType: String,
      sourceUrl: String,
      providerResponse: mongoose.Schema.Types.Mixed,
      uploadedAt: Date,
    }],
    clarificationUpdatedAt: Date,
    termsId: String, termsAcceptedAt: Date, termsVersionAt: Date,
    oauthStateHash: String, oauthStateExpiresAt: Date, oauthConnectedAt: Date,
    oauthAccessToken: String, oauthRefreshToken: String, oauthScope: String,
    oauthAccountId: String, oauthExpiresAt: Date,
    lastSyncedAt: Date,
  },
}, { timestamps: true });

export default mongoose.models.MerchantBusiness || mongoose.model('MerchantBusiness', schema);
