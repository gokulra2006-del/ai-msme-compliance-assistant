// backend/src/models/Evidence.js
const mongoose = require('mongoose');

const EvidenceSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  obligationCode: { type: String, required: true, index: true }, // e.g. FSSAI-001
  documentType: { type: String, required: true }, // e.g. "FSSAI License Copy"
  documentName: { type: String, required: true }, // user-facing name
  filePath: { type: String, required: true }, // server path
  originalFileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true }, // bytes
  issueDate: { type: Date },
  expiryDate: { type: Date },
  verificationStatus: {
    type: String,
    // PENDING is retained for records created before Prompt 2. New uploads
    // begin as UNVERIFIED and can only be verified by an authorised reviewer.
    enum: ['PENDING', 'UNVERIFIED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'ARCHIVED'],
    default: 'UNVERIFIED'
  },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  reviewNotes: { type: String },
  notes: { type: String },

  // --- Document Intelligence Additions ---
  processingStatus: {
    type: String,
    enum: ['UPLOADED', 'PROCESSING', 'PROCESSED', 'NEEDS_REVIEW', 'FAILED', 'OCR_NOT_CONFIGURED'],
    default: 'UPLOADED'
  },
  classification: {
    documentType: { type: String },
    confidence: { type: Number, default: 0 },
    source: { type: String, enum: ['TEXT_EXTRACTION', 'FILENAME', 'USER_LABEL', 'NONE'], default: 'NONE' }
  },
  extractedFields: [{
    field: String,
    value: String,
    confidence: Number,
    originalText: String,
    correctedValue: String,
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    correctedAt: Date
  }],
  relatedObligationSuggestion: { type: String },
  obligationMatch: {
    obligationCode: { type: String },
    obligationTitle: { type: String },
    confidence: { type: Number, default: 0 },
    status: { type: String, enum: ['NONE', 'POSSIBLE_MATCH', 'LINKED'], default: 'NONE' },
    linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    linkedAt: { type: Date }
  },
  extraction: {
    textAvailable: { type: Boolean, default: false },
    textPreview: { type: String },
    notice: { type: String }
  },
  potentialIssues: [{ type: String }],
  missingInformation: [String],
  fileHash: { type: String, index: true },
  version: { type: Number, default: 1 },
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
  isLatestVersion: { type: Boolean, default: true }

}, { timestamps: true });

// Compound index for fast lookups
EvidenceSchema.index({ business: 1, obligationCode: 1 });

module.exports = mongoose.model('Evidence', EvidenceSchema);
