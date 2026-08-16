const express = require('express');
const { createRule, getRules, updateRule, createRuleVersion, approveRuleChange, updateRuleStatus } = require('../controllers/adminRuleController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes here require ADMIN role
router.use(protect);
router.use(authorize('ADMIN'));

router.route('/')
  .get(getRules)
  .post(createRule);

router.route('/:id')
  .put(updateRule);

router.route('/:id/status')
  .put(updateRuleStatus);

router.route('/:code/versions')
  .post(createRuleVersion);

router.route('/proposals/:id/approve')
  .put(approveRuleChange);

module.exports = router;
