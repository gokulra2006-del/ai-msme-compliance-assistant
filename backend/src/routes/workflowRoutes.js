const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const workflowController = require('../controllers/workflowController');

// All workflow routes require authentication
router.use(protect);

// Action Assignment (Owner/Compliance Officer only)
router.post('/action/:id/assign', authorize('OWNER', 'COMPLIANCE_OFFICER'), workflowController.assignAction);

// Action Submission
router.post('/action/:id/submit', workflowController.submitAction);

// Action Approval/Rejection (Owner/Compliance Officer only)
router.post('/action/:id/approve', authorize('OWNER', 'COMPLIANCE_OFFICER'), workflowController.approveAction);
router.post('/action/:id/reject', authorize('OWNER', 'COMPLIANCE_OFFICER'), workflowController.rejectAction);

// Evidence Workflow
router.post('/evidence/:id/submit', workflowController.submitEvidenceReview);
router.post('/evidence/:id/approve', authorize('OWNER', 'COMPLIANCE_OFFICER'), workflowController.approveEvidence);
router.post('/evidence/:id/reject', authorize('OWNER', 'COMPLIANCE_OFFICER'), workflowController.rejectEvidence);

module.exports = router;
