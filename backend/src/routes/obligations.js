const express = require('express');
const { getObligations, getObligation, getDashboard } = require('../controllers/obligationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', protect, getDashboard);
router.get('/', protect, getObligations);
router.get('/:id', protect, getObligation);

module.exports = router;
