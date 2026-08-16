const mongoose = require('mongoose');

const RegulatoryUpdateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'RegulatorySource' },
  
  receivedDate: { type: Date, default: Date.now },
  publicationDate: { type: Date },
  effectiveDate: { type: Date },
  
  affectedStates: [{ type: String }],
  affectedIndustries: [{ type: String }],
  affectedRuleCodes: [{ type: String }],
  
  proposedChanges: { type: String },
  
  changeType: {
    type: String,
    enum: ['NEW_RULE', 'AMENDED_RULE', 'REPEALED_RULE', 'THRESHOLD_CHANGED', 'DEADLINE_CHANGED', 'DOCUMENT_CHANGED', 'REGISTRATION_CHANGED', 'PENALTY_CHANGED', 'FREQUENCY_CHANGED', 'APPLICABILITY_CHANGED', 'OTHER'],
    default: 'OTHER'
  },
  oldRequirement: { type: mongoose.Schema.Types.Mixed },
  newRequirement: { type: mongoose.Schema.Types.Mixed },
  
  status: { 
    type: String, 
    enum: ['DRAFT', 'UNDER_REVIEW', 'VERIFIED', 'APPROVED', 'EFFECTIVE', 'REJECTED', 'SUPERSEDED', 'ARCHIVED'],
    default: 'DRAFT'
  },
  
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: { type: String },

  impactAnalysisStatus: {
    type: String,
    enum: ['NOT_ANALYZED', 'ANALYZING', 'ANALYZED', 'REQUIRES_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'NOT_ANALYZED'
  },
  impactAnalysisResult: { type: mongoose.Schema.Types.Mixed },

}, { timestamps: true });

module.exports = mongoose.model('RegulatoryUpdate', RegulatoryUpdateSchema);
