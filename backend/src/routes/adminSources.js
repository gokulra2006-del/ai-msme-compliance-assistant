const express = require('express');
const { getSources, createSource, updateSource, verifySource } = require('../controllers/regulatorySourceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('ADMIN'));

router.route('/')
  .get(getSources)
  .post(createSource);

router.route('/:id')
  .put(updateSource);

router.route('/:id/verify')
  .put(verifySource);

module.exports = router;
