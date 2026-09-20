import mongoose from 'mongoose';

import { FIELD_KEYS, INPUT_TYPES, SERVICE_KEYS } from '../config/serviceCatalog.js';

/**
 * An operator (mobile / DTH) or BBPS biller (credit card / electricity /
 * FASTag) that users can pay through ClubAPI.
 *
 * `code` is the identifier ClubAPI expects: the operatorId for recharges, the
 * bbpsId for bills. It is kept in its own field so one unique index covers both
 * kinds.
 */
const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, enum: FIELD_KEYS, required: true },
    label: { type: String, required: true, trim: true },
    placeholder: { type: String, default: '', trim: true },
    hint: { type: String, default: '', trim: true },
    inputType: { type: String, enum: INPUT_TYPES, default: 'text' },
    minLength: { type: Number, default: 0 },
    maxLength: { type: Number, default: 64 },
    pattern: { type: String, default: '' },
    uppercase: { type: Boolean, default: false },
  },
  { _id: false }
);

const serviceProviderSchema = new mongoose.Schema(
  {
    service: { type: String, enum: SERVICE_KEYS, required: true, index: true },
    name: { type: String, required: true, trim: true },
    /** operatorId (recharge) or bbpsId (bill). */
    code: { type: String, required: true, trim: true },
    state: { type: String, default: '', trim: true },
    enabled: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 100 },
    /** Empty means "use the service's default fields". */
    fields: { type: [fieldSchema], default: [] },
    /** Bills only: false for billers that cannot fetch (pay-by-amount). */
    supportsFetch: { type: Boolean, default: true },
    source: { type: String, enum: ['seed', 'clubapi_sync', 'admin'], default: 'admin' },
    clubapiName: { type: String, default: '' },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

serviceProviderSchema.index({ service: 1, code: 1 }, { unique: true });
serviceProviderSchema.index({ service: 1, enabled: 1, sortOrder: 1, name: 1 });

export default mongoose.models.ServiceProvider ||
  mongoose.model('ServiceProvider', serviceProviderSchema);
