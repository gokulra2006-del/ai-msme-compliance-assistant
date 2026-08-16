const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const AuditLog = require('../models/AuditLog');

exports.getUpdates = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    
    const query = {};
    if (req.query.status) query.status = req.query.status;

    const updates = await RegulatoryUpdate.find(query)
      .populate('source')
      .populate('submittedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
      
    const total = await RegulatoryUpdate.countDocuments(query);

    res.status(200).json({ success: true, count: updates.length, total, data: updates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createUpdate = async (req, res) => {
  try {
    const update = new RegulatoryUpdate({
      ...req.body,
      submittedBy: req.user._id
    });
    await update.save();
    
    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: 'REGULATORY_UPDATE_CREATED',
      entity: 'RegulatoryUpdate',
      entityId: update._id,
      newValue: { title: update.title }
    });

    res.status(201).json({ success: true, data: update });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateUpdateStatus = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    
    if (!['RECEIVED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'PUBLISHED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const update = await RegulatoryUpdate.findById(req.params.id);
    if (!update) return res.status(404).json({ success: false, error: 'Regulatory update not found' });

    const prevStatus = update.status;
    update.status = status;
    update.reviewedBy = req.user._id;
    if (reviewNotes) update.reviewNotes = reviewNotes;
    
    await update.save();

    let auditAction = 'REGULATORY_UPDATE_UPDATED';
    if (status === 'UNDER_REVIEW') auditAction = 'REGULATORY_UPDATE_REVIEWED';
    if (status === 'VERIFIED') auditAction = 'REGULATORY_UPDATE_VERIFIED';
    if (status === 'REJECTED') auditAction = 'REGULATORY_UPDATE_REJECTED';
    if (status === 'PUBLISHED') auditAction = 'REGULATORY_UPDATE_PUBLISHED';

    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: auditAction,
      entity: 'RegulatoryUpdate',
      entityId: update._id,
      previousValue: { status: prevStatus },
      newValue: { status: update.status, reviewNotes: update.reviewNotes }
    });

    res.status(200).json({ success: true, data: update });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
