// backend/src/routes/evidence.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  uploadEvidence,
  getAllEvidence,
  getFilterOptions,
  getEvidence,
  getEvidenceText,
  getEvidenceVersions,
  getEvidenceByObligation,
  downloadEvidence,
  updateEvidence,
  archiveEvidence,
  purgeEvidence,
  verifyEvidence,
  correctEvidenceMetadata,
  confirmExtraction,
  acknowledgeDuplicateFlag,
  analyzeEvidence,
  linkEvidenceToObligation,
  getEvidenceDashboard,
  getDataQuality,
  getCapabilities
} = require('../controllers/evidenceController');

// Every route below requires a valid session. Authorisation is enforced on the
// server for each action — the UI's own restrictions are never relied upon.
// Business scoping happens inside the controller, so no request can reach
// another business's documents.
router.use(protect);

// --- Collection-level reads ---
router.get('/dashboard', getEvidenceDashboard);
router.get('/data-quality', getDataQuality);
router.get('/capabilities', getCapabilities);
router.get('/filters', getFilterOptions);
router.post('/upload', upload.single('file'), uploadEvidence);
router.get('/', getAllEvidence);
router.get('/obligation/:code', getEvidenceByObligation);

// --- Single-document reads ---
router.get('/:id', getEvidence);
router.get('/:id/text', getEvidenceText);
router.get('/:id/versions', getEvidenceVersions);
router.get('/:id/download', downloadEvidence);

// --- Single-document writes ---
router.put('/:id', updateEvidence);
router.post('/:id/analyze', analyzeEvidence);
router.put('/:id/link-obligation', linkEvidenceToObligation);
router.put('/:id/confirm-extraction', confirmExtraction);
router.put('/:id/duplicate-ack', acknowledgeDuplicateFlag);

// Archive is the normal removal path — the record and file are retained as
// history. Permanent deletion is separate, ADMIN-only, and requires a reason.
router.delete('/:id', archiveEvidence);
router.put('/:id/archive', archiveEvidence);
router.delete('/:id/purge', authorize('ADMIN'), purgeEvidence);

// A review decision (accept/reject) may only be made by a reviewer role.
router.put('/:id/verify', authorize('ADMIN', 'COMPLIANCE_OFFICER', 'OWNER'), verifyEvidence);
router.put('/:id/correction', authorize('ADMIN', 'COMPLIANCE_OFFICER', 'OWNER'), correctEvidenceMetadata);

module.exports = router;
