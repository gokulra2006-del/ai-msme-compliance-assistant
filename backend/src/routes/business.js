const express = require('express');
const { createBusiness, getBusiness, updateBusiness, getActivity, getAdminMetrics, getDigitalTwin } = require('../controllers/businessController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, authorize('OWNER', 'ADMIN'), createBusiness);
router.get('/', protect, getBusiness);
router.put('/', protect, authorize('OWNER', 'ADMIN'), updateBusiness);
router.get('/profile', protect, getDigitalTwin);
router.get('/activity', protect, getActivity);
router.get('/admin/metrics', protect, authorize('ADMIN'), getAdminMetrics);

router.get('/users', protect, authorize('OWNER', 'COMPLIANCE_OFFICER'), async (req, res) => {
  try {
    const business = await require('../models/Business').findOne({ user: req.user.id });
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
    
    // In this app, users might not have a direct `business` ref unless we added it. Wait, `User.js` HAS `business` ref: `{ type: mongoose.Schema.Types.ObjectId, ref: 'Business' }`
    const users = await require('../models/User').find({ business: business._id }).select('name email role');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
