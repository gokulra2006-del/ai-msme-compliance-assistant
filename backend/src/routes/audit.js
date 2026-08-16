const express = require('express');
const { getAuditLogs } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Only ADMIN, COMPLIANCE_OFFICER, and OWNER can view audit logs.
// The controller itself ensures they only see their own business if they are not ADMIN.
router.get('/', protect, authorize('ADMIN', 'COMPLIANCE_OFFICER', 'OWNER'), getAuditLogs);

module.exports = router;
