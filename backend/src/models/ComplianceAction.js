const mongoose = require('mongoose');

const ComplianceActionSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  ruleCode: { type: String, required: true },
  obligationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceRule' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true }, // equivalent to domain
  frequency: { type: String }, // e.g. "Annual"
  dueDate: { type: Date },
  reminderDate: { type: Date },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedRole: { type: String },
  priority: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  
  // Tracking
  completionDate: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Rule Evaluation State
  applicability: { type: String, enum: ['APPLIES', 'INSUFFICIENT_DATA', 'DOES_NOT_APPLY'], required: true },
  
  // Evidence
  evidenceRequired: [{ type: String }],
  evidenceDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
  
  notes: { type: String },
  
  // Submission Assistance
  submissionRecord: {
    status: { type: String, enum: ['NOT_STARTED', 'READY', 'SUBMITTED', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED'], default: 'NOT_STARTED' },
    referenceNumber: { type: String },
    submissionDate: { type: Date },
    acknowledgementDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
    notes: { type: String }
  },

  source: { type: String }, // e.g. "RULE_EVALUATION", "EVIDENCE_EXPIRY", "MANUAL"
  
}, { timestamps: true });

// Compound index for fast lookups and unique constraint on system-generated actions
ComplianceActionSchema.index({ business: 1, ruleCode: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceAction', ComplianceActionSchema);
