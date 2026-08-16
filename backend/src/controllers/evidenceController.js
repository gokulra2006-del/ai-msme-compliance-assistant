// backend/src/controllers/evidenceController.js
const Evidence = require('../models/Evidence');
const Business = require('../models/Business');
const ComplianceRule = require('../models/ComplianceRule');
const { logAudit } = require('../utils/auditLogger');
const { evaluateRules } = require('../engine/rulesEngine');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { UPLOAD_DIR } = require('../middleware/upload');
const DocumentIntelligenceService = require('../services/documentIntelligenceService');

// Helper: get the user's business, with authorization check
async function getUserBusiness(userId) {
  const business = await Business.findOne({ user: userId });
  return business;
}

function hasExpectedSignature(file, buffer) {
  if (file.mimetype === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  return false;
}

// POST /api/evidence/upload — Upload a new evidence document
exports.uploadEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(400).json({ success: false, error: 'No business profile found. Complete onboarding first.' });

    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });

    const { obligationCode, documentType, documentName, issueDate, expiryDate, notes, force } = req.body;
    if (!obligationCode || !documentType || !documentName) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'obligationCode, documentType, and documentName are required.' });
    }

    // 1. Validate the binary signature as well as the Multer MIME allowlist.
    // Browsers can spoof MIME metadata; a mismatched file is never retained.
    const fileBuffer = fs.readFileSync(req.file.path);
    if (!hasExpectedSignature(req.file, fileBuffer)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'The uploaded file content does not match an allowed PDF, PNG, or JPEG format.' });
    }

    // 2. Compute File Hash for Duplicate Detection
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const fileHash = hashSum.digest('hex');

    // 3. Duplicate Check
    if (force !== 'true') {
      const duplicate = await Evidence.findOne({ business: business._id, fileHash });
      if (duplicate) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        return res.status(409).json({ success: false, error: 'Similar document already exists.', duplicate: true });
      }
    }

    // 4. Versioning Logic
    const previousDoc = await Evidence.findOne({
      business: business._id,
      obligationCode,
      documentType,
      isLatestVersion: true
    });

    let newVersion = 1;
    let previousVersionId = null;

    if (previousDoc) {
      previousDoc.isLatestVersion = false;
      await previousDoc.save();
      newVersion = previousDoc.version + 1;
      previousVersionId = previousDoc._id;
    }

    // 5. Create Evidence Record
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
      processingStatus: 'UPLOADED'
    });

    await logAudit({
      req,
      action: 'EVIDENCE_UPLOADED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      metadata: { documentType, obligationCode, fileName: req.file.filename, version: newVersion }
    });

    // 6. Trigger document intelligence asynchronously. Upload success never
    // implies that metadata or classification has been verified.
    DocumentIntelligenceService.processDocument(evidence._id, req).catch(err => {
      console.error('Failed to kick off document processing:', err);
    });

    res.status(201).json({ success: true, data: evidence });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence — Get all evidence for the user's business
exports.getAllEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(200).json({ success: true, data: [] });

    const filter = { business: business._id };
    if (req.query.latest === 'true') filter.isLatestVersion = true;
    const evidence = await Evidence.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/obligation/:code — Get evidence for a specific obligation
exports.getEvidenceByObligation = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(200).json({ success: true, data: [] });

    const evidence = await Evidence.find({ business: business._id, obligationCode: req.params.code }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/:id — Get a single evidence document
exports.getEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    res.status(200).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/:id/download — Download/view evidence file
exports.downloadEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    const filePath = path.join(UPLOAD_DIR, evidence.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'File not found on server' });

    const safeFilename = path.basename(evidence.originalFileName).replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    await logAudit({
      req,
      action: 'EVIDENCE_DOWNLOADED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id — Update evidence metadata
exports.updateEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    // Keep previous value
    const previousValue = evidence.toObject();

    const allowed = ['documentName', 'issueDate', 'expiryDate', 'notes'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) evidence[key] = req.body[key];
    }
    await evidence.save();

    await logAudit({
      req,
      action: 'EVIDENCE_UPDATED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: { updated: allowed.filter(k => req.body[k] !== undefined) }
    });

    res.status(200).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/evidence/:id — Delete evidence
exports.deleteEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    // Delete the physical file
    const filePath = path.join(UPLOAD_DIR, evidence.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await Evidence.deleteOne({ _id: evidence._id });

    await logAudit({
      req,
      action: 'EVIDENCE_DELETED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      metadata: { documentType: evidence.documentType, obligationCode: evidence.obligationCode }
    });

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id/verify — Change verification status (admin/compliance officer only)
exports.verifyEvidence = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['UNVERIFIED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid verification status.' });
    }

    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    const previousValue = evidence.toObject();
    
    evidence.verificationStatus = status;
    evidence.verifiedBy = req.user.id;
    evidence.verifiedAt = new Date();
    if (reviewNotes !== undefined) evidence.reviewNotes = String(reviewNotes).slice(0, 2000);
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
      action: actionMap[status],
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject()
    });

    res.status(200).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/evidence/:id/correction — Correct extracted metadata
exports.correctEvidenceMetadata = async (req, res) => {
  try {
    const { corrections } = req.body;
    if (!Array.isArray(corrections)) {
      return res.status(400).json({ success: false, error: 'corrections must be an array' });
    }

    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    const previousValue = evidence.toObject();

    corrections.forEach(corr => {
      // Find existing extracted field
      let fieldObj = evidence.extractedFields.find(f => f.field === corr.field);
      if (fieldObj) {
        fieldObj.correctedValue = corr.value;
        fieldObj.correctedBy = req.user.id;
        fieldObj.correctedAt = new Date();
      } else {
        // If the field wasn't extracted at all, we can manually add it
        evidence.extractedFields.push({
          field: corr.field,
          value: null, // it wasn't originally extracted
          correctedValue: corr.value,
          correctedBy: req.user.id,
          correctedAt: new Date()
        });
      }
    });

    await evidence.save();

    await logAudit({
      req,
      action: 'DOCUMENT_METADATA_CORRECTED',
      entity: 'Evidence',
      entityId: evidence._id,
      businessId: business._id,
      previousValue,
      newValue: evidence.toObject(),
      metadata: { corrections }
    });

    res.status(200).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/evidence/:id/analyze — retry non-destructive metadata analysis
exports.analyzeEvidence = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    const analysed = await DocumentIntelligenceService.processDocument(evidence._id, req);
    res.status(200).json({ success: true, data: analysed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Document analysis failed. Please verify manually.' });
  }
};

// PUT /api/evidence/:id/link-obligation — human-confirmed evidence mapping.
// This deliberately does not complete a compliance action.
exports.linkEvidenceToObligation = async (req, res) => {
  try {
    const { obligationCode } = req.body;
    if (!obligationCode) return res.status(400).json({ success: false, error: 'obligationCode is required.' });

    const business = await getUserBusiness(req.user.id);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
    const evidence = await Evidence.findOne({ _id: req.params.id, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    const rule = await ComplianceRule.findOne({
      ruleCode: obligationCode,
      status: { $nin: ['INACTIVE', 'EXPIRED', 'ARCHIVED'] }
    }).lean();
    if (!rule) return res.status(404).json({ success: false, error: 'Verified obligation was not found.' });

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
      metadata: { obligationCode, actionCompleted: false }
    });
    res.status(200).json({ success: true, data: evidence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/evidence/dashboard — Evidence summary + missing document detection
exports.getEvidenceDashboard = async (req, res) => {
  try {
    const business = await getUserBusiness(req.user.id);
    if (!business) {
      return res.status(200).json({
        success: true,
        data: { hasProfile: false, summary: {}, requiredDocuments: [] }
      });
    }

    // 1. Run rules engine to find applicable obligations
    const evaluated = evaluateRules(business.toObject());
    const applicable = evaluated.filter(e => e.applicability === 'APPLIES');

    // 2. Get all evidence for this business
    const allEvidence = await Evidence.find({ business: business._id, isLatestVersion: true });

    // 3. Build required documents list with status detection
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const requiredDocuments = [];

    for (const obl of applicable) {
      if (!obl.requiredEvidenceTypes || obl.requiredEvidenceTypes.length === 0) continue;
      for (const docType of obl.requiredEvidenceTypes) {
        // Find matching evidence
        const match = allEvidence.find(ev => ev.obligationCode === obl.code && ev.documentType === docType);
        let docStatus = 'MISSING';
        let expiryDate = null;
        let evidenceId = null;
        let verificationStatus = null;

        if (match) {
          evidenceId = match._id;
          expiryDate = match.expiryDate;
          verificationStatus = match.verificationStatus;

          if (match.expiryDate && new Date(match.expiryDate) < now) {
            docStatus = 'EXPIRED';
          } else if (match.expiryDate && new Date(match.expiryDate) < thirtyDaysFromNow) {
            docStatus = 'EXPIRING_SOON';
          } else {
            docStatus = 'UPLOADED';
          }
        }

        requiredDocuments.push({
          obligationCode: obl.code,
          obligationTitle: obl.title,
          documentType: docType,
          status: docStatus,
          expiryDate,
          evidenceId,
          verificationStatus,
          severity: obl.severity
        });
      }
    }

    // 4. Calculate summary
    const totalRequired = requiredDocuments.length;
    const uploaded = requiredDocuments.filter(d => d.status === 'UPLOADED').length;
    const missing = requiredDocuments.filter(d => d.status === 'MISSING').length;
    const expiringSoon = requiredDocuments.filter(d => d.status === 'EXPIRING_SOON').length;
    const expired = requiredDocuments.filter(d => d.status === 'EXPIRED').length;
    const pendingVerification = requiredDocuments.filter(d => ['PENDING', 'UNVERIFIED', 'UNDER_REVIEW'].includes(d.verificationStatus)).length;

    res.status(200).json({
      success: true,
      data: {
        hasProfile: true,
        summary: { totalRequired, uploaded, missing, expiringSoon, expired, pendingVerification },
        requiredDocuments
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
