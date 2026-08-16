const express = require('express');
const { getBusinessImpacts } = require('../controllers/businessUpdatesController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/impact')
  .get(getBusinessImpacts);

module.exports = router;
