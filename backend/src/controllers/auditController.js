const AuditLog = require('../models/AuditLog');

// @desc    Get audit logs with filtering and pagination
// @route   GET /api/audit-logs
// @access  Private (ADMIN, or scoped to business for OWNER/COMPLIANCE_OFFICER)
exports.getAuditLogs = async (req, res) => {
  try {
    const { action, entity, businessId, startDate, endDate, page = 1, limit = 50 } = req.query;

    const query = {};

    // Role-based access control
    if (req.user.role !== 'ADMIN') {
      // Non-admins can only see their business's audit logs
      if (!req.user.business) {
        return res.status(403).json({ success: false, error: 'User does not belong to a business' });
      }
      query.business = req.user.business;
    } else {
      // Admins can query specific businesses
      if (businessId) {
        query.business = businessId;
      }
    }

    if (action) query.action = action;
    if (entity) query.entity = entity;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: logs
    });
  } catch (err) {
    console.error('Audit Log Fetch Error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
