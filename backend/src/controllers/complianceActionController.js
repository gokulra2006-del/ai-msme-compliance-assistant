const ComplianceAction = require('../models/ComplianceAction');
const Business = require('../models/Business');
const ComplianceRule = require('../models/ComplianceRule');
const Evidence = require('../models/Evidence');
const { evaluateRules } = require('../engine/rulesEngine');
const { logAudit } = require('../utils/auditLogger');

// Helper to calculate dynamic status
const calculateStatus = (action) => {
  if (action.completionDate) return 'COMPLETED';
  if (action.applicability === 'DOES_NOT_APPLY') return 'NOT_APPLICABLE';
  if (action.applicability === 'INSUFFICIENT_DATA') return 'NEEDS_REVIEW';

  if (!action.dueDate) {
    return 'ON_TRACK'; // If no due date, we assume on track until one is set
  }

  const now = new Date();
  const due = new Date(action.dueDate);
  
  if (due < now) return 'OVERDUE';
  
  // Due soon if within 30 days
  const diffTime = Math.abs(due.getTime() - now.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  if (diffDays <= 30) return 'DUE_SOON';
  
  return 'ON_TRACK';
};

exports.syncActions = async (req, res) => {
  try {
    const businessId = req.user.businessId || req.body.businessId;
    if (!businessId) {
       // if user has no business, return early
       const business = await Business.findOne({ user: req.user.id });
       if (!business) return res.status(200).json({ success: true, message: 'No business found' });
    }
    
    const business = await Business.findOne({ _id: businessId || (await Business.findOne({ user: req.user.id }))._id });
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });

    // 1. Sync from Rules Engine
    const allRules = await ComplianceRule.find({ active: true });
    const evaluated = evaluateRules(business.toObject(), allRules);

    for (const e of evaluated) {
      if (e.applicability === 'APPLIES' || e.applicability === 'INSUFFICIENT_DATA') {
        const priority = e.severity || 'MEDIUM';
        
        await ComplianceAction.findOneAndUpdate(
          { business: business._id, ruleCode: e.code, source: 'RULE_EVALUATION' },
          {
            $set: {
              title: e.title,
              description: e.description,
              category: e.domain,
              frequency: e.cadence,
              priority: priority,
              applicability: e.applicability,
              evidenceRequired: e.requiredEvidenceTypes || [],
            }
          },
          { upsert: true, new: true }
        );
      } else if (e.applicability === 'DOES_NOT_APPLY') {
        // If it was previously tracked but now DOES_NOT_APPLY, we could mark it NOT_APPLICABLE
        await ComplianceAction.findOneAndUpdate(
          { business: business._id, ruleCode: e.code, source: 'RULE_EVALUATION' },
          { $set: { applicability: 'DOES_NOT_APPLY' } }
        );
      }
    }

    // 2. Sync from Evidence Expiries
    const expiringEvidences = await Evidence.find({ 
      business: business._id, 
      expiryDate: { $ne: null } 
    });

    for (const ev of expiringEvidences) {
      await ComplianceAction.findOneAndUpdate(
        { business: business._id, ruleCode: ev.obligationCode, source: 'EVIDENCE_EXPIRY' },
        {
          $set: {
            title: `Renew: ${ev.documentName}`,
            description: `Evidence document "${ev.documentName}" is expiring.`,
            category: 'Evidence Renewal',
            dueDate: ev.expiryDate,
            priority: 'HIGH',
            applicability: 'APPLIES',
            evidenceRequired: [ev.documentType]
          },
          $addToSet: { evidenceDocumentIds: ev._id }
        },
        { upsert: true }
      );
    }

    res.status(200).json({ success: true, message: 'Sync complete' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getActions = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) return res.status(200).json({ success: true, data: [] });

    // Validate business ID matching to prevent IDOR
    if (business.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
        // Just enforcing standard access here, actual IDOR check:
        // We only fetch actions where business === their business._id
    }

    let filter = { business: business._id, applicability: { $ne: 'DOES_NOT_APPLY' } };

    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { ruleCode: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    let actions = await ComplianceAction.find(filter).populate('evidenceDocumentIds').sort({ dueDate: 1 }).lean();

    // Map calculated status
    actions = actions.map(a => ({
      ...a,
      status: calculateStatus(a)
    }));

    if (req.query.status) {
      actions = actions.filter(a => a.status === req.query.status);
    }

    res.status(200).json({ success: true, data: actions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) return res.status(200).json({ success: true, data: null });

    const actions = await ComplianceAction.find({ 
      business: business._id, 
      applicability: { $in: ['APPLIES', 'INSUFFICIENT_DATA'] } 
    }).lean();

    let overdue = 0, dueSoon = 0, onTrack = 0, completed = 0, pending = 0;
    
    actions.forEach(a => {
      const status = calculateStatus(a);
      if (status === 'OVERDUE') overdue++;
      else if (status === 'DUE_SOON') dueSoon++;
      else if (status === 'ON_TRACK' || status === 'NEEDS_REVIEW') onTrack++;
      else if (status === 'COMPLETED') completed++;
      
      if (status !== 'COMPLETED') pending++;
    });

    const upcoming = actions
      .filter(a => !a.completionDate && a.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5)
      .map(a => ({ ...a, status: calculateStatus(a) }));

    res.status(200).json({
      success: true,
      data: {
        totalApplicable: actions.length,
        overdue,
        dueSoon,
        onTrack,
        completed,
        pending,
        upcoming
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markCompleted = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) return res.status(403).json({ success: false, error: 'No business found' });

    const action = await ComplianceAction.findOne({ _id: req.params.id, business: business._id });
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });

    const previousValue = action.toObject();

    action.completionDate = new Date();
    action.completedBy = req.user.id;
    await action.save();

    await logAudit({
      req,
      action: 'COMPLIANCE_ACTION_COMPLETED',
      entity: 'ComplianceAction',
      entityId: action._id,
      businessId: business._id,
      previousValue,
      newValue: action.toObject()
    });

    res.status(200).json({ success: true, data: action });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.reopenAction = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) return res.status(403).json({ success: false, error: 'No business found' });

    const action = await ComplianceAction.findOne({ _id: req.params.id, business: business._id });
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });

    const previousValue = action.toObject();

    action.completionDate = null;
    action.completedBy = null;
    await action.save();

    await logAudit({
      req,
      action: 'COMPLIANCE_ACTION_REOPENED',
      entity: 'ComplianceAction',
      entityId: action._id,
      businessId: business._id,
      previousValue,
      newValue: action.toObject()
    });

    res.status(200).json({ success: true, data: action });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.attachEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.body;
    const business = await Business.findOne({ user: req.user.id });
    
    const evidence = await Evidence.findOne({ _id: evidenceId, business: business._id });
    if (!evidence) return res.status(404).json({ success: false, error: 'Evidence not found' });

    const action = await ComplianceAction.findOne({ _id: req.params.id, business: business._id });
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });

    if (!action.evidenceDocumentIds.includes(evidence._id)) {
      action.evidenceDocumentIds.push(evidence._id);
      await action.save();
    }

    res.status(200).json({ success: true, data: action });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateSubmissionRecord = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) return res.status(403).json({ success: false, error: 'No business found' });

    const action = await ComplianceAction.findOne({ _id: req.params.id, business: business._id });
    if (!action) return res.status(404).json({ success: false, error: 'Action not found' });

    const { status, referenceNumber, acknowledgementDocumentId, notes } = req.body;
    
    if (!action.submissionRecord) {
        action.submissionRecord = {};
    }

    if (status) action.submissionRecord.status = status;
    if (referenceNumber) action.submissionRecord.referenceNumber = referenceNumber;
    if (acknowledgementDocumentId) {
       action.submissionRecord.acknowledgementDocumentId = acknowledgementDocumentId;
       action.submissionRecord.status = 'ACKNOWLEDGED';
    }
    if (notes) action.submissionRecord.notes = notes;
    
    if (status === 'SUBMITTED' || status === 'ACKNOWLEDGED') {
        action.submissionRecord.submissionDate = action.submissionRecord.submissionDate || new Date();
    }

    await action.save();

    await logAudit({
      req,
      action: 'SUBMISSION_RECORD_UPDATED',
      entity: 'ComplianceAction',
      entityId: action._id,
      businessId: business._id,
      metadata: { submissionStatus: action.submissionRecord.status }
    });

    res.status(200).json({ success: true, data: action });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
