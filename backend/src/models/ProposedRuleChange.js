const mongoose = require('mongoose');

const ProposedRuleChangeSchema = new mongoose.Schema({
  ruleCode: { type: String, required: true },
  currentVersion: { type: String, required: true },
  proposedVersion: { type: String, required: true },
  
  // Proposed Fields
  proposedConditions: { type: Map, of: mongoose.Schema.Types.Mixed },
  proposedEvidence: [{ type: String }],
  proposedSeverity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  proposedFrequency: { type: String },
  proposedSource: { type: mongoose.Schema.Types.ObjectId, ref: 'RegulatorySource' },
  
  effectiveDate: { type: Date, required: true },
  reason: { type: String, required: true },
  
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ProposedRuleChange', ProposedRuleChangeSchema);
