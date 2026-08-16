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
  status: { 
    type: String, 
    enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  completionDate: { type: Date },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: { type: String },
  reviewNotes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String,
    date: { type: Date, default: Date.now }
  }],
  
  // Rule Evaluation State
  applicability: { type: String, enum: ['APPLIES', 'INSUFFICIENT_DATA', 'DOES_NOT_APPLY'], required: true },
  
  // Evidence
  evidenceRequired: [{ type: String }],
  evidenceDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
  
  notes: { type: String },
  
  // Submission Assistance
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegulatorySubmission' },

  source: { type: String }, // e.g. "RULE_EVALUATION", "EVIDENCE_EXPIRY", "MANUAL"
  
}, { timestamps: true });

// Compound index for fast lookups and unique constraint on system-generated actions
ComplianceActionSchema.index({ business: 1, ruleCode: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('ComplianceAction', ComplianceActionSchema);
