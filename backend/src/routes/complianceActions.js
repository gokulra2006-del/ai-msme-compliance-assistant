const express = require('express');
const router = express.Router();
const complianceActionController = require('../controllers/complianceActionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/sync', complianceActionController.syncActions);
router.get('/', complianceActionController.getActions);
router.get('/dashboard', complianceActionController.getDashboardSummary);
router.put('/:id/complete', complianceActionController.markCompleted);
router.put('/:id/reopen', complianceActionController.reopenAction);
router.post('/:id/evidence', complianceActionController.attachEvidence);
router.post('/:id/submit-record', complianceActionController.updateSubmissionRecord);

module.exports = router;
