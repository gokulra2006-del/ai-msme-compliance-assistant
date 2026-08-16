// backend/src/routes/evidence.js
const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  uploadEvidence,
  getAllEvidence,
  getEvidenceByObligation,
  getEvidence,
  downloadEvidence,
  updateEvidence,
  deleteEvidence,
  verifyEvidence,
  getEvidenceDashboard,
  correctEvidenceMetadata,
  analyzeEvidence,
  linkEvidenceToObligation
} = require('../controllers/evidenceController');

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/dashboard', getEvidenceDashboard);
router.post('/upload', upload.single('file'), uploadEvidence);
router.get('/', getAllEvidence);
router.get('/obligation/:code', getEvidenceByObligation);
router.get('/:id', getEvidence);
router.get('/:id/download', downloadEvidence);
router.put('/:id', updateEvidence);
router.delete('/:id', deleteEvidence);
router.post('/:id/analyze', analyzeEvidence);
router.put('/:id/link-obligation', linkEvidenceToObligation);
router.put('/:id/verify', authorize('ADMIN', 'COMPLIANCE_OFFICER'), verifyEvidence);
router.put('/:id/correction', authorize('ADMIN', 'COMPLIANCE_OFFICER'), correctEvidenceMetadata);

module.exports = router;
