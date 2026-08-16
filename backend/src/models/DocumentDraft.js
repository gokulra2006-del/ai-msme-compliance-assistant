const mongoose = require('mongoose');

// Generated drafts intentionally live outside Evidence. Evidence represents an
// uploaded record that may be verified; a draft must never become evidence or
// an official filing simply because somebody generated it.
const DocumentDraftSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  obligationCode: { type: String, required: true, index: true },
  complianceAction: { type: mongoose.Schema.Types.ObjectId, ref: 'ComplianceAction' },
  documentType: { type: String, required: true },
  templateKey: { type: String, required: true },
  content: { type: String, required: true },
  informationSnapshot: [{
    key: String,
    label: String,
    value: String,
    source: { type: String, enum: ['USER_ENTERED', 'VERIFIED_EVIDENCE'] }
  }],
  evidenceUsed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, required: true, default: 1 },
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentDraft' },
  isCurrent: { type: Boolean, default: true, index: true },
  documentStatus: {
    type: String,
    enum: ['NOT_STARTED', 'MISSING_INFORMATION', 'READY_TO_GENERATE', 'GENERATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'],
    default: 'GENERATED'
  },
  changeReason: { type: String, maxlength: 1000 },
  reviewNotes: { type: String, maxlength: 2000 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, { timestamps: true });

DocumentDraftSchema.index({ business: 1, obligationCode: 1, documentType: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('DocumentDraft', DocumentDraftSchema);
