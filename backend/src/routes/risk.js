const express = require('express');
const router = express.Router();
const riskController = require('../controllers/riskController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/score', riskController.getRiskScore);
router.get('/history', riskController.getRiskHistory);

module.exports = router;
