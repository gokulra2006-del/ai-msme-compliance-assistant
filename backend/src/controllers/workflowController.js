const ComplianceAction = require('../models/ComplianceAction');
const Evidence = require('../models/Evidence');
const { logAudit } = require('../utils/auditLogger');
const Business = require('../models/Business');

// Middleware helper to ensure business isolation
const verifyBusinessAccess = async (req, item) => {
  const business = await Business.findOne({ user: req.user.id });
  if (!business || business._id.toString() !== item.business.toString()) {
    throw new Error('Unauthorized cross-business access');
  }
  return business;
};

// ----------------------------------------------------
// COMPLIANCE ACTION WORKFLOWS
// ----------------------------------------------------

exports.assignAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, reviewer, note } = req.body;

    const action = await ComplianceAction.findById(id);
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });
    await verifyBusinessAccess(req, action);

    action.assignedTo = assignedTo;
    action.reviewer = reviewer || req.user._id;
    action.status = 'ASSIGNED';
    
    if (note) {
      action.reviewNotes.push({ user: req.user._id, note, date: new Date() });
    }

    await action.save();

    await logAudit({
      req,
      action: 'ACTION_ASSIGNED',
      businessId: action.business,
      metadata: { actionId: id, assignedTo }
    });

    res.json({ success: true, data: action });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
};

exports.submitAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const action = await ComplianceAction.findById(id);
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });
    await verifyBusinessAccess(req, action);

    // Only assignee or owner can submit
    if (req.user.role !== 'OWNER' && action.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only assigned user can submit this action' });
    }

    action.status = 'SUBMITTED_FOR_REVIEW';
    action.completedBy = req.user._id;
    action.completionDate = new Date();
    
    if (note) {
      action.reviewNotes.push({ user: req.user._id, note, date: new Date() });
    }

    await action.save();

    await logAudit({
      req,
      action: 'ACTION_SUBMITTED',
      businessId: action.business,
      metadata: { actionId: id }
    });

    res.json({ success: true, data: action });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
};

exports.approveAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const action = await ComplianceAction.findById(id);
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });
    await verifyBusinessAccess(req, action);

    // Self-approval protection
    if (action.completedBy?.toString() === req.user._id.toString() && req.user.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Cannot self-approve your own submitted work' });
    }

    action.status = 'APPROVED';
    if (note) action.reviewNotes.push({ user: req.user._id, note, date: new Date() });

    await action.save();

    await logAudit({
      req,
      action: 'ACTION_APPROVED',
      businessId: action.business,
      metadata: { actionId: id }
    });

    res.json({ success: true, data: action });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
};

exports.rejectAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const action = await ComplianceAction.findById(id);
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });
    await verifyBusinessAccess(req, action);

    if (!reason) return res.status(400).json({ success: false, error: 'Rejection reason is required' });

    action.status = 'REJECTED';
    action.rejectionReason = reason;
    action.reviewNotes.push({ user: req.user._id, note: `REJECTED: ${reason}`, date: new Date() });
    
    // Clear completion state to force resubmission
    action.completedBy = null;
    action.completionDate = null;

    await action.save();

    await logAudit({
      req,
      action: 'ACTION_REJECTED',
      businessId: action.business,
      metadata: { actionId: id, reason }
    });

    res.json({ success: true, data: action });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
};

// ----------------------------------------------------
// EVIDENCE WORKFLOWS
// ----------------------------------------------------

exports.submitEvidenceReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const ev = await Evidence.findById(id);
    if (!ev) return res.status(404).json({ success: false, error: 'Evidence not found' });
    await verifyBusinessAccess(req, ev);

    ev.verificationStatus = 'UNDER_REVIEW';
    if (note) ev.reviewNotes = (ev.reviewNotes ? ev.reviewNotes + '\n' : '') + `${req.user.name}: ${note}`;

    await ev.save();

    await logAudit({
      req,
      action: 'EVIDENCE_SUBMITTED',
      businessId: ev.business,
      metadata: { evidenceId: id }
    });

    res.json({ success: true, data: ev });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
};

exports.approveEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const ev = await Evidence.findById(id);
    if (!ev) return res.status(404).json({ success: false, error: 'Evidence not found' });
    await verifyBusinessAccess(req, ev);

    // Self-approval protection
    if (ev.uploadedBy.toString() === req.user._id.toString() && req.user.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Cannot self-approve evidence you uploaded' });
    }

    ev.verificationStatus = 'VERIFIED';
    ev.verifiedBy = req.user._id;
    ev.verifiedAt = new Date();
    if (note) ev.reviewNotes = (ev.reviewNotes ? ev.reviewNotes + '\n' : '') + `[APPROVED]: ${note}`;

    await ev.save();

    await logAudit({
      req,
      action: 'EVIDENCE_APPROVED',
      businessId: ev.business,
      metadata: { evidenceId: id }
    });

    res.json({ success: true, data: ev });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
};

exports.rejectEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ success: false, error: 'Rejection reason required' });

    const ev = await Evidence.findById(id);
    if (!ev) return res.status(404).json({ success: false, error: 'Evidence not found' });
    await verifyBusinessAccess(req, ev);

    ev.verificationStatus = 'REJECTED';
    ev.reviewNotes = (ev.reviewNotes ? ev.reviewNotes + '\n' : '') + `[REJECTED]: ${reason}`;

    await ev.save();

    await logAudit({
      req,
      action: 'EVIDENCE_REJECTED',
      businessId: ev.business,
      metadata: { evidenceId: id, reason }
    });

    res.json({ success: true, data: ev });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
};
