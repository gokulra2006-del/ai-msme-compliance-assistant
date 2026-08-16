const mongoose = require('mongoose');
const ObligationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // e.g., FSSAI-001
  title: { type: String, required: true },
  description: { type: String, required: true },
  domain: { type: String, required: true }, // e.g., Food Safety, Labour, Environmental
  regulator: { type: String, required: true }, // e.g., FSSAI, MPCB
  jurisdiction: { type: String, required: true }, // Central, Maharashtra, Local
  cadence: { type: String, required: true }, // One-time, Annual, Monthly
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
  penalty: { type: String },
  imprisonmentFlag: { type: Boolean, default: false },
  licenceSuspensionFlag: { type: Boolean, default: false },
  requiredEvidenceTypes: [{ type: String }],
  authority: { type: String },
  sourceReference: { type: String },
  effectiveFrom: { type: Date },
  effectiveTo: { type: Date },
  ruleVersion: { type: String },
  status: { type: String, enum: ['ACTIVE', 'DEPRECATED', 'DRAFT'], default: 'ACTIVE' },
  // Adding applicability statuses as an enum for when we link obligations to businesses
  applicability: { type: String, enum: ['APPLIES', 'DOES_NOT_APPLY', 'INSUFFICIENT_DATA'] }
});
module.exports = mongoose.model('Obligation', ObligationSchema);
