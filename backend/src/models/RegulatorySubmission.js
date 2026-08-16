const mongoose = require('mongoose');

const SubmissionTimelineEventSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { type: String, required: true },
  notes: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const SubmissionQuerySchema = new mongoose.Schema({
  queryDate: { type: Date, default: Date.now },
  authorityMessage: { type: String, required: true },
  requestedDocuments: [{ type: String }],
  responseDeadline: { type: Date },
  responseDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
  responseStatus: { type: String, enum: ['PENDING', 'SUBMITTED'], default: 'PENDING' },
  responseDate: { type: Date }
});

const RegulatorySubmissionSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  obligation: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceRule', required: true },
  complianceAction: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceAction', required: true, unique: true },
  regulatorySource: { type: mongoose.Schema.Types.ObjectId, ref: 'RegulatorySource' },
  
  authority: { type: String },
  officialPortalUrl: { type: String },
  
  submissionStatus: { 
    type: String, 
    enum: [
      'NOT_STARTED', 'PREPARATION_REQUIRED', 'DOCUMENTS_MISSING', 
      'READY_FOR_SUBMISSION', 'SUBMITTED_BY_USER', 'ACKNOWLEDGEMENT_RECEIVED', 
      'UNDER_REVIEW', 'QUERY_RECEIVED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'
    ],
    default: 'NOT_STARTED'
  },
  
  // Readiness Checklist Tracking
  requiredDocuments: [{ type: String }],
  
  // Lifecycle Dates
  startedAt: { type: Date, default: Date.now },
  readyAt: { type: Date },
  submittedAt: { type: Date },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Post-submission data
  acknowledgementNumber: { type: String },
  acknowledgementDate: { type: Date },
  governmentReferenceId: { type: String },
  acknowledgementReceiptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
  
  notes: { type: String },
  
  queries: [SubmissionQuerySchema],
  timeline: [SubmissionTimelineEventSchema]
  
}, { timestamps: true });

module.exports = mongoose.model('RegulatorySubmission', RegulatorySubmissionSchema);
