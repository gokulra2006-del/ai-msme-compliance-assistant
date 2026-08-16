const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const controller = require('../controllers/documentDraftController');

const router = express.Router();
router.use(protect);

router.get('/preparation/:obligationCode', controller.getPreparation);
router.get('/', controller.listDrafts);
router.post('/', controller.generateDraft);
router.get('/:id/download', controller.downloadDraft);
router.get('/:id', controller.getDraft);
router.put('/:id', controller.updateDraftContent);
router.put('/:id/status', authorize('ADMIN', 'COMPLIANCE_OFFICER'), controller.updateDraftStatus);

module.exports = router;
