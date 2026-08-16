const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/:actionId', submissionController.getSubmission);
router.post('/:actionId/start', authorize('OWNER', 'COMPLIANCE_OFFICER', 'ADMIN'), submissionController.startSubmission);
router.put('/:submissionId/ready', authorize('OWNER', 'COMPLIANCE_OFFICER'), submissionController.markReady);
router.post('/:submissionId/external-submit', authorize('OWNER', 'COMPLIANCE_OFFICER'), submissionController.recordExternalSubmission);
router.post('/:submissionId/acknowledge', authorize('OWNER', 'COMPLIANCE_OFFICER'), submissionController.attachAcknowledgement);
router.post('/:submissionId/query', authorize('COMPLIANCE_OFFICER', 'ADMIN'), submissionController.addQuery);

module.exports = router;
