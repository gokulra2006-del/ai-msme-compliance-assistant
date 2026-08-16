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
    // Where the value came from. Required by Prompt 16 §7 so a reviewer can
    // always tell an extracted value apart from a manually entered one.
    source: {
      type: String,
      enum: ['DOCUMENT_TEXT', 'FILENAME', 'USER_ENTERED', 'USER_CORRECTION', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    originalText: String,
    correctedValue: String,
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    correctedAt: Date
  }],

  // Normalised copies of the two identifiers a reviewer looks for first. These
  // are only ever populated from the document's own text or from a human
  // correction — never inferred from regulatory assumptions.
  documentNumber: { type: String, index: true },
  issuingAuthority: { type: String },

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
    notice: { type: String },
    // NOT_ATTEMPTED  -> analysis has not run yet
    // EXTRACTED      -> machine-readable text was recovered
    // NO_TEXT_LAYER  -> file parsed but contained no usable text layer
    // OCR_NOT_AVAILABLE -> image-only file and no OCR engine is installed
    // FAILED         -> the file could not be parsed at all
    status: {
      type: String,
      enum: ['NOT_ATTEMPTED', 'EXTRACTED', 'NO_TEXT_LAYER', 'OCR_NOT_AVAILABLE', 'FAILED'],
      default: 'NOT_ATTEMPTED'
    },
    textLength: { type: Number, default: 0 },
    pageCount: { type: Number, default: null },
    // Full extracted text is kept for review/analysis but is never included in
    // list responses (select: false) so document contents are not broadcast.
    fullText: { type: String, select: false }
  },

  // OCR is reported, never faked. NOT_APPLICABLE for text-bearing files,
  // NOT_AVAILABLE when an image would need OCR that is not installed.
  ocrStatus: {
    type: String,
    enum: ['NOT_APPLICABLE', 'NOT_AVAILABLE'],
    default: 'NOT_APPLICABLE'
  },

  // Plain-language summary derived ONLY from this document's own contents and
  // stored metadata. It contains no regulatory interpretation.
  documentSummary: { type: String },

  potentialIssues: [{ type: String }],
  missingInformation: [String],

  // Duplicate candidates are flagged for human review only. Nothing is deleted
  // or modified automatically (Prompt 16 §33).
  duplicateFlags: [{
    reason: {
      type: String,
      enum: ['IDENTICAL_FILE', 'SAME_DOCUMENT_NUMBER', 'SAME_TYPE_AND_ISSUE_DATE']
    },
    relatedEvidence: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
    detectedAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false }
  }],

  fileHash: { type: String, index: true },
  version: { type: Number, default: 1 },
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
  isLatestVersion: { type: Boolean, default: true },
  supersededAt: { type: Date },
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },

  // Review state of the extraction itself, distinct from verificationStatus
  // which is the review state of the document as compliance evidence.
  reviewStatus: {
    type: String,
    enum: ['NOT_REVIEWED', 'EXTRACTION_CONFIRMED', 'EXTRACTION_CORRECTED'],
    default: 'NOT_REVIEWED'
  },

  // Archive instead of destroy. Historical evidence is never silently removed.
  archived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  archiveReason: { type: String }

}, { timestamps: true });

// Compound index for fast lookups
EvidenceSchema.index({ business: 1, obligationCode: 1 });
EvidenceSchema.index({ business: 1, isLatestVersion: 1, archived: 1 });
EvidenceSchema.index({ business: 1, verificationStatus: 1 });
EvidenceSchema.index({ business: 1, expiryDate: 1 });

module.exports = mongoose.model('Evidence', EvidenceSchema);
