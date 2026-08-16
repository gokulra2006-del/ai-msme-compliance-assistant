const express = require('express');
const { getUpdates, createUpdate, updateUpdateStatus, getDashboardMetrics } = require('../controllers/regulatoryUpdateController');
const { analyzeImpact, getUpdateDetails } = require('../controllers/impactAnalysisController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN'));

router.route('/')
  .get(getUpdates)
  .post(createUpdate);

router.route('/dashboard')
  .get(getDashboardMetrics);

router.route('/:id')
  .get(getUpdateDetails);

router.route('/:id/status')
  .put(updateUpdateStatus);

router.route('/:id/analyze-impact')
  .post(analyzeImpact);

module.exports = router;
