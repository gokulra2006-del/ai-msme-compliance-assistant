const Business = require('../models/Business');
const { logAudit } = require('../utils/auditLogger');
const AuditLog = require('../models/AuditLog');
const ComplianceRule = require('../models/ComplianceRule');

exports.createBusiness = async (req, res) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id;

    // Check for existing business
    const existingBusiness = await Business.findOne({ user: req.user.id });
    if (existingBusiness) {
      return res.status(400).json({ success: false, error: 'Business already exists for this user. Use PUT to update.' });
    }

    // Custom validations
    if (req.body.totalWorkers !== undefined && req.body.totalWorkers < 0) {
      return res.status(400).json({ success: false, error: 'Total workers cannot be negative.' });
    }
    if (req.body.contractWorkers !== undefined && req.body.totalWorkers !== undefined) {
      if (req.body.contractWorkers > req.body.totalWorkers) {
        return res.status(400).json({ success: false, error: 'Contract workers cannot exceed total workers.' });
      }
    }
    if (req.body.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(req.body.gstin)) {
      return res.status(400).json({ success: false, error: 'Invalid GSTIN format.' });
    }

    const business = await Business.create(req.body);
    await logAudit({ req, action: 'BUSINESS_CREATED', entity: 'Business', entityId: business._id, businessId: business._id });

    res.status(201).json({ success: true, data: business });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getBusiness = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id }).populate('applicableObligations.obligation');
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }
    res.status(200).json({ success: true, data: business });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

const rulesEngine = require('../engine/rulesEngine');
exports.getDigitalTwin = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id }).lean();
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    const activeRules = await ComplianceRule.find({ status: 'ACTIVE' });
    const evaluatedRules = rulesEngine.evaluateRules(business, activeRules);

    // Filter to only APPLIES for the digital twin view
    const applicable = evaluatedRules.filter(r => r.status === 'APPLIES');

    res.status(200).json({ 
      success: true, 
      data: {
        profile: business,
        evaluatedObligations: applicable
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    let business = await Business.findOne({ user: req.user.id });
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    // Custom validations
    if (req.body.totalWorkers !== undefined && req.body.totalWorkers < 0) {
      return res.status(400).json({ success: false, error: 'Total workers cannot be negative.' });
    }
    
    // Check against existing or new values for totalWorkers
    const newTotalWorkers = req.body.totalWorkers !== undefined ? req.body.totalWorkers : business.totalWorkers;
    const newContractWorkers = req.body.contractWorkers !== undefined ? req.body.contractWorkers : business.contractWorkers;
    
    if (newContractWorkers !== undefined && newTotalWorkers !== undefined) {
      if (newContractWorkers > newTotalWorkers) {
        return res.status(400).json({ success: false, error: 'Contract workers cannot exceed total workers.' });
      }
    }
    
    if (req.body.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(req.body.gstin)) {
      return res.status(400).json({ success: false, error: 'Invalid GSTIN format.' });
    }

    // Keep original for diff
    const previousValue = business.toObject();

    business = await Business.findOneAndUpdate({ user: req.user.id }, req.body, {
      new: true,
      runValidators: true
    });

    await logAudit({ req, action: 'BUSINESS_UPDATED', entity: 'Business', entityId: business._id, businessId: business._id, previousValue, newValue: business.toObject() });

    res.status(200).json({ success: true, data: business });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getActivity = async (req, res) => {
  try {
    const business = await Business.findOne({ user: req.user.id });
    if (!business) {
      return res.status(200).json({ success: true, data: [] });
    }

    const logs = await AuditLog.find({ business: business._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

const User = require('../models/User');

exports.getAdminMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeBusinesses = await Business.countDocuments();
    const totalRules = await ComplianceRule.countDocuments({ status: 'ACTIVE' });
    
    // Recent audit events
    const recentActivity = await AuditLog.find()
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeBusinesses,
        totalRules,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
