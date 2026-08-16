// backend/src/controllers/evidenceController.js
const Evidence = require('../models/Evidence');
const ComplianceRule = require('../models/ComplianceRule');
const { logAudit } = require('../utils/auditLogger');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { UPLOAD_DIR, MAX_SIZE, ALLOWED_TYPES } = require('../middleware/upload');
const DocumentIntelligenceService = require('../services/documentIntelligenceService');
const EvidenceIntelligence = require('../services/evidenceIntelligenceService');
const {
  getExpiryStatus,
  daysUntilExpiry,
  buildTraceability,
  INSUFFICIENT_DATA
} = require('../utils/evidenceStatus');

// Roles allowed to make a review decision on evidence. Enforced on the server;
// the UI's own restrictions are never relied upon (Prompt 16 §28).
const REVIEWER_ROLES = ['ADMIN', 'COMPLIANCE_OFFICER', 'OWNER'];

// Helper: resolve the caller's business. Every query below is scoped by it, so
// no user can read or write another business's evidence.
async function getUserBusiness(user) {
  return EvidenceIntelligence.resolveBusinessForUser(user);
}

/**
 * Loads one evidence record scoped to the caller's business.
 * Returns { error, status } instead of throwing so callers stay flat.
 */
async function loadOwnEvidence(req, { select } = {}) {
  const business = await getUserBusiness(req.user);
  if (!business) return { error: 'Business not found', status: 404 };
  let query = Evidence.findOne({ _id: req.params.id, business: business._id });
  if (select) query = query.select(select);
  const evidence = await query;
  if (!evidence) return { error: 'Evidence not found', status: 404 };
  return { business, evidence };
}

function hasExpectedSignature(file, buffer) {
  if (file.mimetype === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  return false;
}

/**
 * Resolves a stored file path and refuses anything that escapes the upload
 * directory. filePath is generated server-side, but this is enforced anyway so a
 * tampered or legacy record can never read an arbitrary file.
 */
function resolveStoredFile(filePath) {
  if (!filePath) return null;
  const safeName = path.basename(String(filePath));
  const resolved = path.resolve(UPLOAD_DIR, safeName);
  const root = path.resolve(UPLOAD_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function storedFileExists(filePath) {
  const resolved = resolveStoredFile(filePath);
  return Boolean(resolved && fs.existsSync(resolved));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Adds derived, non-authoritative status information to a record for the UI.
 * Derived only from what is stored — no regulatory inference.
 */
function decorate(record, now = new Date()) {
  const plain = record.toObject ? record.toObject() : { ...record };
  delete plain.extraction?.fullText;
  return {
    ...plain,
    expiryStatus: getExpiryStatus(plain.expiryDate, now),
    daysUntilExpiry: daysUntilExpiry(plain.expiryDate, now),
    potentialIssueDetails: DocumentIntelligenceService.describeIssues(plain.potentialIssues || []),
    missingInformationDetails: DocumentIntelligenceService.describeMissingInformation(plain.missingInformation || []),
    hasUnacknowledgedDuplicates: (plain.duplicateFlags || []).some(flag => !flag.acknowledged)
  };
}

// GET /api/evidence/capabilities — what this deployment can actually do.
// Reported honestly so the UI never implies a capability that is absent.
exports.getCapabilities = async (req, res) => {
  const ocr = DocumentIntelligenceService.getOcrCapability();
  res.status(200).json({
    success: true,
    data: {
      ocr,
      textExtraction: { available: true, supports: ['application/pdf'], note: 'PDFs with a selectable text layer only. Scans are not read.' },
      maxFileSizeBytes: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
      confidenceScoring: { available: true, scale: '0-100', note: 'A text-matching score for the extraction, not a legal certainty score.' },
      notices: {
        verification: EvidenceIntelligence.VERIFICATION_MEANING,
        extraction: EvidenceIntelligence.EXTRACTION_MEANING
      }
    }
  });
};

// POST /api/evidence/upload — Upload a new evidence document
exports.uploadEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user);
    if (!business) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'No business profile found. Complete onboarding first.' });
    }

    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    const { obligationCode, documentType, documentName, issueDate, expiryDate, notes, force } = req.body;
    if (!obligationCode || !documentType || !documentName) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'obligationCode, documentType, and documentName are required.' });
    }

    // 1. Validate the binary signature as well as the Multer MIME allowlist.
    // Browsers can spoof MIME metadata; a mismatched file is never retained. A
    // valid extension is never treated on its own as proof the file is safe.
    const fileBuffer = fs.readFileSync(req.file.path);
    if (!hasExpectedSignature(req.file, fileBuffer)) {
      fs.unlinkSync(req.file.path);
      await logAudit({
        req,
        action: 'EVIDENCE_UPLOAD_REJECTED',
        entity: 'Evidence',
        businessId: business._id,
        metadata: { reason: 'CONTENT_TYPE_MISMATCH', declaredType: req.file.mimetype, originalFileName: req.file.originalname }
      });
      return res.status(400).json({ success: false, error: 'The uploaded file content does not match an allowed PDF, PNG, or JPEG format.' });
    }
    if (fileBuffer.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'The uploaded file is empty (0 bytes).' });
    }

    // 2. File hash, used for duplicate detection only.
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 3. Byte-identical upload guard. Overridable with force=true, in which case
    // the record is still created and the duplicate is flagged for review rather
    // than blocked (nothing is ever deleted automatically).
    if (force !== 'true') {
      const duplicate = await Evidence.findOne({ business: business._id, fileHash, archived: { $ne: true } });
      if (duplicate) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        return res.status(409).json({
          success: false,
          error: 'An identical file already exists in this vault.',
          duplicate: true,
          existing: { evidenceId: duplicate._id, documentName: duplicate.documentName, documentType: duplicate.documentType }
        });
      }
    }

    // 4. Versioning — the previous document is superseded, never overwritten.
    const previousDoc = await Evidence.findOne({
      business: business._id,
      obligationCode,
      documentType,
      isLatestVersion: true,
      archived: { $ne: true }
    });

    let newVersion = 1;
    let previousVersionId = null;

    if (previousDoc) {
      newVersion = (previousDoc.version || 1) + 1;
      previousVersionId = previousDoc._id;
    }

    // 5. Create the record. It starts UNVERIFIED — upload never implies review.
    const evidence = await Evidence.create({
      business: business._id,
      uploadedBy: req.user.id,
      obligationCode,
      documentType,
      documentName,
      filePath: req.file.filename,
      originalFileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      notes: notes || '',
      fileHash,
      version: newVersion,
      previousVersion: previousVersionId,
      isLatestVersion: true,
      verificationStatus: 'UNVERIFIED',
      processingStatus: 'UPLOADED'
    });

    if (previousDoc) {
      previousDoc.isLatestVersion = false;
      previousDoc.supersededAt = new Date();
      previousDoc.supersededBy = evidence._id;
      await previousDoc.save();
      await logAudit({
        req,
        action: 'EVIDENCE_REPLACED',
        entity: 'Evidence',
        entityId: previousDoc._id,
        businessId: business._id,
        metadata: {
          supersededBy: String(evidence._id),
          previousVersion: previousDoc.version,
          newVersion,
          retained: true,
          note: 'Previous version retained as history. It was not overwritten or deleted.'
        }
      });
    }

    // Values the user typed are recorded as USER_ENTERED so a reviewer can always
    // tell them apart from values read out of the document.
    const manualFields = [];
    if (issueDate) manualFields.push({ field: 'issueDate', value: String(issueDate), source: 'USER_ENTERED', confidence: null });
    if (expiryDate) manualFields.push({ field: 'expiryDate', value: String(expiryDate), source: 'USER_ENTERED', confidence: null });
    if (manualFields.length) {
      evidence.extractedFields.push(...manualFields);
      await evidence.save();
    }

    await logAudit({
      req,
      action: 'EVIDENCE_UPLOADED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      metadata: { documentType, obligationCode, fileName: req.file.filename, originalFileName: req.file.originalname, fileSize: req.file.size, version: newVersion, forced: force === 'true' }
    });

    // 6. Analysis runs after the response. Upload success never implies that
    // metadata, classification or validity has been verified.
    DocumentIntelligenceService.processDocument(evidence._id, req).catch(err => {
      console.error('Failed to kick off document processing:', err.message);
    });

    res.status(201).json({
      success: true,
      data: decorate(evidence),
      notice: 'Document stored and queued for automated reading. It is UNVERIFIED until an authorised reviewer accepts it.'
    });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence — filterable, searchable vault listing
exports.getAllEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user);
    if (!business) return res.status(200).json({ success: true, data: [], filtersApplied: {}, total: 0 });

    const {
      latest, includeArchived, documentType, obligationCode, verificationStatus,
      processingStatus, classification, uploadedBy, expiry, flagged, duplicates,
      from, to, search
    } = req.query;

    const filter = { business: business._id };
    if (latest === 'true') filter.isLatestVersion = { $ne: false };
    if (includeArchived !== 'true') filter.archived = { $ne: true };
    if (documentType) filter.documentType = documentType;
    if (obligationCode) filter.obligationCode = obligationCode;
    if (verificationStatus) filter.verificationStatus = { $in: String(verificationStatus).split(',') };
    if (processingStatus) filter.processingStatus = { $in: String(processingStatus).split(',') };
    if (classification) filter['classification.documentType'] = classification;
    if (uploadedBy) filter.uploadedBy = uploadedBy;
    if (flagged === 'true') filter['potentialIssues.0'] = { $exists: true };
    if (duplicates === 'true') filter['duplicateFlags.0'] = { $exists: true };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search) {
      const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
      filter.$or = [
        { documentName: pattern },
        { originalFileName: pattern },
        { documentType: pattern },
        { documentNumber: pattern },
        { issuingAuthority: pattern },
        { obligationCode: pattern }
      ];
    }

    const now = new Date();
    let records = await Evidence.find(filter)
      .populate('uploadedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    // Expiry is a derived state, so it is filtered after the query rather than
    // stored as a duplicate field that could drift out of date.
    if (expiry) {
      const wanted = String(expiry).split(',');
      records = records.filter(record => wanted.includes(getExpiryStatus(record.expiryDate, now)));
    }

    res.status(200).json({
      success: true,
      total: records.length,
      data: records.map(record => decorate(record, now)),
      filtersApplied: { latest, includeArchived, documentType, obligationCode, verificationStatus, processingStatus, classification, uploadedBy, expiry, flagged, duplicates, from, to, search },
      notices: {
        verification: EvidenceIntelligence.VERIFICATION_MEANING,
        extraction: EvidenceIntelligence.EXTRACTION_MEANING
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/filters — distinct filter values from real records only
exports.getFilterOptions = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user);
    if (!business) return res.status(200).json({ success: true, data: { documentTypes: [], obligationCodes: [], uploaders: [], classifications: [] } });

    const [documentTypes, obligationCodes, classifications, uploaderRecords] = await Promise.all([
      Evidence.distinct('documentType', { business: business._id }),
      Evidence.distinct('obligationCode', { business: business._id }),
      Evidence.distinct('classification.documentType', { business: business._id }),
      Evidence.find({ business: business._id }).populate('uploadedBy', 'name email role').select('uploadedBy').lean()
    ]);

    const uploaders = [];
    const seen = new Set();
    uploaderRecords.forEach(record => {
      const uploader = record.uploadedBy;
      if (!uploader || seen.has(String(uploader._id))) return;
      seen.add(String(uploader._id));
      uploaders.push({ id: uploader._id, name: uploader.name, role: uploader.role });
    });

    res.status(200).json({
      success: true,
      data: {
        documentTypes: documentTypes.filter(Boolean).sort(),
        obligationCodes: obligationCodes.filter(Boolean).sort(),
        classifications: classifications.filter(Boolean).sort(),
        uploaders,
        verificationStatuses: ['UNVERIFIED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'ARCHIVED', 'PENDING'],
        expiryStates: ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'NOT_DETECTED']
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/obligation/:code — evidence + required-evidence status for one obligation
exports.getEvidenceByObligation = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user);
    if (!business) return res.status(200).json({ success: true, data: [] });

    const [records, status] = await Promise.all([
      Evidence.find({ business: business._id, obligationCode: req.params.code })
        .populate('uploadedBy', 'name email role')
        .sort({ createdAt: -1 })
        .lean(),
      EvidenceIntelligence.getObligationEvidenceStatus({ business, obligationCode: req.params.code })
    ]);

    res.status(200).json({
      success: true,
      data: records.map(record => decorate(record)),
      requiredEvidence: status.checklist,
      traceability: status.traceability,
      noRequirementNotice: status.noRequirementNotice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/:id — full detail: metadata, extraction, traceability, versions
exports.getEvidence = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    await evidence.populate([
      { path: 'uploadedBy', select: 'name email role' },
      { path: 'verifiedBy', select: 'name email role' },
      { path: 'archivedBy', select: 'name email role' },
      { path: 'duplicateFlags.relatedEvidence', select: 'documentName documentType documentNumber createdAt obligationCode' }
    ]);

    const rule = evidence.obligationCode
      ? await ComplianceRule.findOne({
        ruleCode: evidence.obligationCode,
        status: { $nin: ['INACTIVE', 'EXPIRED', 'ARCHIVED'] }
      }).populate('regulatorySource').lean()
      : null;

    // Version chain, oldest first. History is always available — replacements
    // never overwrite what came before.
    const versions = await Evidence.find({
      business: business._id,
      obligationCode: evidence.obligationCode,
      documentType: evidence.documentType
    })
      .select('version verificationStatus expiryDate issueDate createdAt isLatestVersion supersededAt documentName archived')
      .sort({ version: 1 })
      .lean();

    await logAudit({
      req,
      action: 'EVIDENCE_VIEWED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id
    });

    res.status(200).json({
      success: true,
      data: {
        ...decorate(evidence),
        fileAvailable: storedFileExists(evidence.filePath),
        // Evidence -> Obligation -> Rule -> Regulatory Source -> GAWK reference
        traceability: buildTraceability({ rule, obligationCode: evidence.obligationCode }),
        versions,
        versionCount: versions.length,
        notices: {
          verification: EvidenceIntelligence.VERIFICATION_MEANING,
          extraction: EvidenceIntelligence.EXTRACTION_MEANING
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/:id/text — extracted text, for review purposes only
exports.getEvidenceText = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req, { select: '+extraction.fullText' });
    if (error) return res.status(status).json({ success: false, error });

    await logAudit({
      req,
      action: 'EVIDENCE_TEXT_VIEWED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id
    });

    res.status(200).json({
      success: true,
      data: {
        status: evidence.extraction?.status || 'NOT_ATTEMPTED',
        notice: evidence.extraction?.notice || null,
        ocrStatus: evidence.ocrStatus,
        textLength: evidence.extraction?.textLength || 0,
        pageCount: evidence.extraction?.pageCount ?? null,
        text: evidence.extraction?.fullText || '',
        // This is the document's own content, never a regulatory statement.
        disclaimer: 'This is text read from the uploaded file. It is not a regulatory requirement and has not been verified against any authority.'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/:id/versions — replacement history
exports.getEvidenceVersions = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    const versions = await Evidence.find({
      business: business._id,
      obligationCode: evidence.obligationCode,
      documentType: evidence.documentType
    })
      .populate('uploadedBy', 'name email role')
      .sort({ version: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: versions.map(version => ({
        ...decorate(version),
        isCurrent: version.isLatestVersion !== false && !version.archived
      })),
      notice: 'Superseded versions are retained as history and are never used to satisfy a current requirement.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/:id/download — authorised file access
exports.downloadEvidence = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    const filePath = resolveStoredFile(evidence.filePath);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on server' });
    }

    const safeFilename = path.basename(evidence.originalFileName || 'document').replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await logAudit({
      req,
      action: 'EVIDENCE_DOWNLOADED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      metadata: { documentType: evidence.documentType, obligationCode: evidence.obligationCode }
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id — update user-maintained metadata
exports.updateEvidence = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    const previousValue = evidence.toObject();
    const allowed = ['documentName', 'issueDate', 'expiryDate', 'notes', 'documentNumber', 'issuingAuthority'];
    const changed = [];

    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      evidence[key] = req.body[key] === '' ? null : req.body[key];
      changed.push(key);
      // Manually entered values are recorded with their source so they are never
      // mistaken for something read out of the document.
      if (['issueDate', 'expiryDate', 'documentNumber', 'issuingAuthority'].includes(key)) {
        const existing = evidence.extractedFields.find(item => item.field === key);
        if (existing) {
          existing.correctedValue = String(req.body[key] ?? '');
          existing.correctedBy = req.user.id;
          existing.correctedAt = new Date();
          existing.source = 'USER_CORRECTION';
        } else if (req.body[key]) {
          evidence.extractedFields.push({
            field: key,
            value: String(req.body[key]),
            source: 'USER_ENTERED',
            confidence: null,
            correctedBy: req.user.id,
            correctedAt: new Date()
          });
        }
      }
    }

    if (!changed.length) return res.status(400).json({ success: false, error: 'No updatable fields supplied.' });
    await evidence.save();

    await logAudit({
      req,
      action: 'EVIDENCE_UPDATED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: { updated: changed }
    });

    res.status(200).json({ success: true, data: decorate(evidence) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/evidence/:id — archive (non-destructive).
// Historical evidence is never silently destroyed (Prompt 16 §§16, 32).
exports.archiveEvidence = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    if (evidence.archived) {
      return res.status(400).json({ success: false, error: 'This document is already archived.' });
    }

    const previousValue = evidence.toObject();
    evidence.archived = true;
    evidence.archivedAt = new Date();
    evidence.archivedBy = req.user.id;
    evidence.archiveReason = req.body?.reason ? String(req.body.reason).slice(0, 500) : 'Archived by user';
    evidence.verificationStatus = 'ARCHIVED';
    evidence.isLatestVersion = false;
    await evidence.save();

    await logAudit({
      req,
      action: 'EVIDENCE_ARCHIVED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: { reason: evidence.archiveReason, fileRetained: true }
    });

    res.status(200).json({
      success: true,
      data: decorate(evidence),
      notice: 'The document was archived. The record and file are retained as history and no longer count towards any requirement.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/evidence/:id/purge — permanent removal, ADMIN only, archive first
exports.purgeEvidence = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    if (!evidence.archived) {
      return res.status(409).json({
        success: false,
        error: 'Archive this document before permanent deletion so the removal is deliberate and auditable.'
      });
    }
    const reason = req.body?.reason;
    if (!reason) return res.status(400).json({ success: false, error: 'A reason is required for permanent deletion.' });

    const snapshot = evidence.toObject();
    const filePath = resolveStoredFile(evidence.filePath);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await Evidence.deleteOne({ _id: evidence._id });

    await logAudit({
      req,
      action: 'EVIDENCE_PURGED',
      entity: 'Evidence',
      entityId: snapshot._id,
      businessId: business._id,
      previousValue: snapshot,
      metadata: { reason: String(reason).slice(0, 500), documentType: snapshot.documentType, obligationCode: snapshot.obligationCode }
    });

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id/verify — reviewer decision.
// VERIFIED here means accepted inside SurakshaSetu, not verified by any authority.
exports.verifyEvidence = async (req, res) => {
  try {
    const { status: newStatus, reviewNotes, reason } = req.body;
    if (!['UNVERIFIED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'ARCHIVED'].includes(newStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid verification status.' });
    }
    if (!REVIEWER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: `Role ${req.user.role} cannot make a review decision on evidence.` });
    }

    const rejectionReason = reason || reviewNotes;
    if (newStatus === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({ success: false, error: 'A rejection reason is required.' });
    }

    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    // Separation of duties: an uploader cannot approve their own document unless
    // they are the business owner.
    if (
      newStatus === 'VERIFIED' &&
      String(evidence.uploadedBy) === String(req.user._id) &&
      req.user.role !== 'OWNER'
    ) {
      return res.status(403).json({ success: false, error: 'You cannot approve evidence you uploaded yourself.' });
    }

    const expiryStatus = getExpiryStatus(evidence.expiryDate);
    if (newStatus === 'VERIFIED' && expiryStatus === 'EXPIRED' && req.body.confirmExpired !== true) {
      return res.status(409).json({
        success: false,
        error: 'This document\'s recorded expiry date has already passed. Confirm explicitly if you still want to accept it.',
        requiresConfirmation: true,
        expiryDate: evidence.expiryDate
      });
    }

    const previousValue = evidence.toObject();
    evidence.verificationStatus = newStatus;
    evidence.verifiedBy = req.user.id;
    evidence.verifiedAt = new Date();
    if (newStatus === 'REJECTED') {
      evidence.reviewNotes = `[REJECTED] ${String(rejectionReason).slice(0, 2000)}`;
    } else if (reviewNotes !== undefined) {
      evidence.reviewNotes = String(reviewNotes).slice(0, 2000);
    }
    if (newStatus === 'ARCHIVED') {
      evidence.archived = true;
      evidence.archivedAt = new Date();
      evidence.archivedBy = req.user.id;
      evidence.isLatestVersion = false;
    }
    await evidence.save();

    const actionMap = {
      UNVERIFIED: 'EVIDENCE_STATUS_RESET',
      UNDER_REVIEW: 'EVIDENCE_MARKED_UNDER_REVIEW',
      VERIFIED: 'EVIDENCE_VERIFIED',
      REJECTED: 'EVIDENCE_REJECTED',
      ARCHIVED: 'EVIDENCE_ARCHIVED'
    };
    await logAudit({
      req,
      action: actionMap[newStatus],
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: {
        reason: newStatus === 'REJECTED' ? String(rejectionReason).slice(0, 500) : undefined,
        acceptedDespiteExpiry: newStatus === 'VERIFIED' && expiryStatus === 'EXPIRED' ? true : undefined,
        decisionScope: 'INTERNAL_REVIEW_ONLY'
      }
    });

    res.status(200).json({
      success: true,
      data: decorate(evidence),
      notice: newStatus === 'VERIFIED' ? EvidenceIntelligence.VERIFICATION_MEANING : undefined
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id/correction — human correction of extracted values
exports.correctEvidenceMetadata = async (req, res) => {
  try {
    const { corrections } = req.body;
    if (!Array.isArray(corrections) || corrections.length === 0) {
      return res.status(400).json({ success: false, error: 'corrections must be a non-empty array' });
    }

    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    const previousValue = evidence.toObject();
    const applied = [];

    corrections.forEach(correction => {
      if (!correction?.field) return;
      const value = correction.value === undefined || correction.value === null ? '' : String(correction.value);
      const existing = evidence.extractedFields.find(item => item.field === correction.field);
      if (existing) {
        // Only record an actual change so a re-save does not look like a correction.
        if ((existing.correctedValue || existing.value || '') === value) return;
        existing.correctedValue = value;
        existing.correctedBy = req.user.id;
        existing.correctedAt = new Date();
        existing.source = 'USER_CORRECTION';
      } else {
        evidence.extractedFields.push({
          field: correction.field,
          value: null, // it was never extracted from the document
          correctedValue: value,
          source: 'USER_CORRECTION',
          correctedBy: req.user.id,
          correctedAt: new Date()
        });
      }
      applied.push({ field: correction.field, value });
    });

    if (!applied.length) {
      return res.status(200).json({ success: true, data: decorate(evidence), notice: 'No values changed.' });
    }

    // Confirmed human values are promoted onto the record so every downstream
    // module (expiry, calendar, risk, inspection) uses the corrected value.
    const valueFor = name => applied.find(item => item.field === name)?.value;
    const promoteDate = (name, target) => {
      const raw = valueFor(name);
      if (raw === undefined) return;
      if (raw === '') { evidence[target] = null; return; }
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) evidence[target] = parsed;
    };
    promoteDate('expiryDate', 'expiryDate');
    promoteDate('issueDate', 'issueDate');
    if (valueFor('documentNumber') !== undefined) evidence.documentNumber = valueFor('documentNumber') || null;
    if (valueFor('issuingAuthority') !== undefined) evidence.issuingAuthority = valueFor('issuingAuthority') || null;

    evidence.reviewStatus = 'EXTRACTION_CORRECTED';
    // A corrected extraction is no longer "unread", but correcting values is not
    // the same as accepting the document as evidence — verification is separate.
    if (evidence.processingStatus === 'NEEDS_REVIEW' || evidence.processingStatus === 'OCR_NOT_CONFIGURED') {
      evidence.processingStatus = 'PROCESSED';
    }
    await evidence.save();

    await logAudit({
      req,
      action: 'DOCUMENT_METADATA_CORRECTED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: { corrections: applied }
    });

    res.status(200).json({ success: true, data: decorate(evidence) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id/confirm-extraction — human confirms the reading is correct.
// This closes the extraction-review step; it does NOT verify the document.
exports.confirmExtraction = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    const previousValue = evidence.toObject();
    evidence.reviewStatus = 'EXTRACTION_CONFIRMED';
    if (req.body?.note) {
      evidence.reviewNotes = `${evidence.reviewNotes ? evidence.reviewNotes + '\n' : ''}[EXTRACTION CONFIRMED] ${String(req.body.note).slice(0, 1000)}`;
    }
    if (evidence.processingStatus === 'NEEDS_REVIEW') evidence.processingStatus = 'PROCESSED';
    await evidence.save();

    await logAudit({
      req,
      action: 'EVIDENCE_EXTRACTION_CONFIRMED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: { verificationStatusUnchanged: evidence.verificationStatus }
    });

    res.status(200).json({
      success: true,
      data: decorate(evidence),
      notice: 'Extraction confirmed. This does not verify the document — a reviewer must still accept it as evidence.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id/duplicate-ack — acknowledge a duplicate flag (nothing deleted)
exports.acknowledgeDuplicateFlag = async (req, res) => {
  try {
    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    if (!evidence.duplicateFlags?.length) {
      return res.status(400).json({ success: false, error: 'This document has no duplicate flags.' });
    }

    const target = req.body?.relatedEvidence;
    let acknowledged = 0;
    evidence.duplicateFlags.forEach(flag => {
      if (target && String(flag.relatedEvidence) !== String(target)) return;
      if (flag.acknowledged) return;
      flag.acknowledged = true;
      acknowledged++;
    });
    evidence.potentialIssues = (evidence.potentialIssues || []).filter(
      code => code !== 'POSSIBLE_DUPLICATE' || evidence.duplicateFlags.some(flag => !flag.acknowledged)
    );
    await evidence.save();

    await logAudit({
      req,
      action: 'EVIDENCE_DUPLICATE_ACKNOWLEDGED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      metadata: { acknowledged, relatedEvidence: target || 'ALL', recordsDeleted: 0 }
    });

    res.status(200).json({ success: true, data: decorate(evidence), notice: 'Duplicate flag acknowledged. No records were deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/evidence/:id/analyze — re-run automated reading (non-destructive)
exports.analyzeEvidence = async (req, res) => {
  try {
    const { error, status, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    const analysed = await DocumentIntelligenceService.processDocument(evidence._id, req);
    res.status(200).json({
      success: true,
      data: decorate(analysed),
      notice: EvidenceIntelligence.EXTRACTION_MEANING
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Document analysis failed. Please verify manually.' });
  }
};

// PUT /api/evidence/:id/link-obligation — human-confirmed obligation mapping.
// The Rules Engine still decides which obligations apply; this only files the
// document against one of them, and never completes a compliance action.
exports.linkEvidenceToObligation = async (req, res) => {
  try {
    const { obligationCode } = req.body;
    if (!obligationCode) return res.status(400).json({ success: false, error: 'obligationCode is required.' });

    const { error, status, business, evidence } = await loadOwnEvidence(req);
    if (error) return res.status(status).json({ success: false, error });

    const rule = await ComplianceRule.findOne({
      ruleCode: obligationCode,
      status: { $nin: ['INACTIVE', 'EXPIRED', 'ARCHIVED'] }
    }).populate('regulatorySource').lean();
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: `Obligation ${obligationCode} is not in the approved ruleset. ${INSUFFICIENT_DATA}`
      });
    }

    const previousValue = evidence.toObject();
    evidence.obligationCode = obligationCode;
    evidence.obligationMatch = {
      obligationCode,
      obligationTitle: rule.title,
      confidence: evidence.obligationMatch?.confidence || 0,
      status: 'LINKED',
      linkedBy: req.user.id,
      linkedAt: new Date()
    };
    await evidence.save();

    await logAudit({
      req,
      action: 'EVIDENCE_LINKED_TO_OBLIGATION',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: { obligationCode, actionCompleted: false, decidedBy: 'HUMAN' }
    });

    res.status(200).json({
      success: true,
      data: {
        ...decorate(evidence),
        traceability: buildTraceability({ rule, obligationCode })
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/dashboard — metrics + required-evidence matrix, all from real records
exports.getEvidenceDashboard = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user);
    if (!business) {
      return res.status(200).json({
        success: true,
        data: { hasProfile: false, summary: {}, requiredDocuments: [], expiringEvidence: [] }
      });
    }

    const intelligence = await EvidenceIntelligence.getEvidenceIntelligence({ business });

    res.status(200).json({
      success: true,
      data: {
        hasProfile: true,
        summary: intelligence.summary,
        requiredDocuments: intelligence.requiredDocuments,
        expiringEvidence: intelligence.expiringEvidence,
        insufficientDataObligations: intelligence.insufficientDataObligations,
        notices: intelligence.notices,
        ocr: DocumentIntelligenceService.getOcrCapability(),
        generatedAt: intelligence.generatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/data-quality — reports problems, changes nothing
exports.getDataQuality = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user);
    if (!business) return res.status(200).json({ success: true, data: { findings: [], totalFindings: 0 } });

    const intelligence = await EvidenceIntelligence.getEvidenceIntelligence({
      business,
      includeDataQuality: true,
      fileExists: storedFileExists
    });

    await logAudit({
      req,
      action: 'EVIDENCE_DATA_QUALITY_AUDITED',
      entity: 'Evidence',
      businessId: business._id,
      metadata: { totalFindings: intelligence.dataQuality.totalFindings, recordsModified: 0 }
    });

    res.status(200).json({ success: true, data: intelligence.dataQuality });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Kept as an explicit export so existing route wiring keeps working.
exports.deleteEvidence = exports.archiveEvidence;
