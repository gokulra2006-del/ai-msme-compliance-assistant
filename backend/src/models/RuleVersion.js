const mongoose = require('mongoose');

const RuleVersionSchema = new mongoose.Schema({
  ruleCode: { type: String, required: true },
  versionNumber: { type: String, required: true },
  previousVersion: { type: String },
  changes: { type: String },
  effectiveDate: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sourceReference: { type: String },
  verificationNotes: { type: String },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('RuleVersion', RuleVersionSchema);
