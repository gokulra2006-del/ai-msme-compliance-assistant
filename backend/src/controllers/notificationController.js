const ComplianceReminder = require('../models/ComplianceReminder');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await ComplianceReminder.find({ recipient: req.user.id })
      .populate('complianceAction', 'title category priority dueDate')
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await ComplianceReminder.countDocuments({ 
        recipient: req.user.id, 
        status: { $in: ['PENDING', 'SENT'] } 
    });
    res.status(200).json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await ComplianceReminder.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { status: 'READ', readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await ComplianceReminder.updateMany(
      { recipient: req.user.id, status: { $in: ['PENDING', 'SENT'] } },
      { status: 'READ', readAt: new Date() }
    );
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAlertsSummary = async (req, res) => {
  try {
    const overdueCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: 'OVERDUE',
      status: { $in: ['PENDING', 'SENT'] }
    });

    const dueTodayCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: 'DUE_TODAY',
      status: { $in: ['PENDING', 'SENT'] }
    });

    const dueSoonCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: { $in: ['DUE_SOON', 'DUE_TOMORROW'] },
      status: { $in: ['PENDING', 'SENT'] }
    });

    const earlyCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: 'EARLY_REMINDER',
      status: { $in: ['PENDING', 'SENT'] }
    });
    
    const escalationCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: 'ESCALATION',
      status: { $in: ['PENDING', 'SENT'] }
    });

    const expiredEvidenceCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: 'EXPIRED_EVIDENCE',
      status: { $in: ['PENDING', 'SENT'] }
    });

    const pendingReviewCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: { $in: ['PENDING_REVIEW', 'PENDING_APPROVAL'] },
      status: { $in: ['PENDING', 'SENT'] }
    });

    const rejectedCount = await ComplianceReminder.countDocuments({
      recipient: req.user.id,
      reminderType: 'REJECTED_EVIDENCE',
      status: { $in: ['PENDING', 'SENT'] }
    });

    res.status(200).json({
      success: true,
      data: {
        overdue: overdueCount,
        dueToday: dueTodayCount,
        dueSoon: dueSoonCount,
        early: earlyCount,
        escalations: escalationCount,
        expiredEvidence: expiredEvidenceCount,
        pendingReview: pendingReviewCount,
        rejected: rejectedCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
