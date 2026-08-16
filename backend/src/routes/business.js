const express = require('express');
const { createBusiness, getBusiness, updateBusiness, getActivity, getAdminMetrics } = require('../controllers/businessController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, authorize('OWNER', 'ADMIN'), createBusiness);
router.get('/', protect, getBusiness);
router.put('/', protect, authorize('OWNER', 'ADMIN'), updateBusiness);
router.get('/activity', protect, getActivity);
router.get('/admin/metrics', protect, authorize('ADMIN'), getAdminMetrics);

module.exports = router;
