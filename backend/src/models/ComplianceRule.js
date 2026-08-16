const mongoose = require('mongoose');

const ComplianceRuleSchema = new mongoose.Schema({
  ruleCode: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  complianceDomain: { type: String, required: true },
  jurisdictionLevel: { 
    type: String, 
    enum: ['CENTRAL', 'STATE', 'UT', 'LOCAL'],
    required: true
  },
  jurisdictionCode: { type: String },
  stateCode: { type: String },
  state: { type: String },
  district: { type: String },
  city: { type: String },
  localBody: { type: String },
  industry: { type: String },
  subIndustry: { type: String },
  regulator: { type: String, required: true },
  applicabilityConditions: { 
    type: Map, 
    of: mongoose.Schema.Types.Mixed,
    description: 'JSON structure defining the deterministic condition (e.g. { "industry": "Food Processing" })'
  },
  requiredEvidence: [{ type: String }],
  complianceFrequency: { type: String }, // e.g. "Annual", "Monthly"
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  penaltyDescription: { type: String },
  imprisonmentRisk: { type: Boolean, default: false },
  licenseSuspensionRisk: { type: Boolean, default: false },
  effectiveDate: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  
  // Future Source Metadata
  sourceName: { type: String },
  authority: { type: String },
  actName: { type: String },
  section: { type: String },
  notificationNumber: { type: String },
  sourceUrl: { type: String },
  effectiveFrom: { type: Date },
  effectiveTo: { type: Date },
  verificationStatus: { type: String, enum: ['VERIFIED', 'REQUIRES_VERIFICATION', 'EXPIRED', 'DEMO'] },

  regulatorySource: { type: mongoose.Schema.Types.ObjectId, ref: 'RegulatorySource' },
  version: { type: String, default: '1.0' },
  status: { type: String, enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'ARCHIVED'], default: 'DRAFT' },
  deactivationReason: { type: String },
}, { timestamps: true });

ComplianceRuleSchema.index({ ruleCode: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceRule', ComplianceRuleSchema);
