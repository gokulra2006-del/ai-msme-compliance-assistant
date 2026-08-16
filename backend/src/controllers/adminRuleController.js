const ComplianceRule = require('../models/ComplianceRule');
const RulePack = require('../models/RulePack');
const RuleVersion = require('../models/RuleVersion');
const RegulatorySource = require('../models/RegulatorySource');
const ProposedRuleChange = require('../models/ProposedRuleChange');
const AuditLog = require('../models/AuditLog');

// Helper to build Mongo query from request filters
const buildQuery = (query) => {
  const mongoQuery = {};
  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    mongoQuery.$or = [{ ruleCode: regex }, { title: regex }];
  }
  if (query.status) mongoQuery.status = query.status;
  if (query.domain) mongoQuery.complianceDomain = query.domain;
  if (query.state) mongoQuery.state = query.state;
  if (query.industry) mongoQuery.industry = query.industry;
  return mongoQuery;
};

// 1️⃣ Get paginated list of latest rule versions (one per ruleCode)
exports.getRules = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const sortParam = req.query.sort || '-createdAt'; // e.g., '-createdAt' or 'title'
    const mongoQuery = buildQuery(req.query);

    const sortField = sortParam.startsWith('-') ? sortParam.slice(1) : sortParam;
    const sortOrder = sortParam.startsWith('-') ? -1 : 1;

    const pipeline = [
      { $match: mongoQuery },
      { $sort: { version: -1 } },
      { $group: { _id: '$ruleCode', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { [sortField]: sortOrder } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const rules = await ComplianceRule.aggregate(pipeline).exec();
    const total = await ComplianceRule.distinct('ruleCode', mongoQuery).then(arr => arr.length);
    res.status(200).json({ success: true, page, limit, total, count: rules.length, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 2️⃣ Get all versions for a particular ruleCode
exports.getRuleVersions = async (req, res) => {
  try {
    const { code } = req.params;
    const versions = await ComplianceRule.find({ ruleCode: code }).sort({ version: -1 });
    if (!versions.length) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.status(200).json({ success: true, count: versions.length, data: versions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 3️⃣ Create a brand‑new rule (initial version)
exports.createRule = async (req, res) => {
  try {
    const { regulatorySource, ...rest } = req.body;
    if (regulatorySource) {
      const source = await RegulatorySource.findById(regulatorySource);
      if (!source) return res.status(400).json({ success: false, error: 'Invalid regulatory source' });
      if (source.verificationStatus !== 'VERIFIED') {
        return res.status(400).json({ success: false, error: 'Cannot create rule with unverified source' });
      }
    }
    const rule = new ComplianceRule({ ...rest, regulatorySource });
    await rule.save();
    
    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: 'RULE_CREATED',
      entity: 'ComplianceRule',
      entityId: rule._id,
      newValue: { ruleCode: rule.ruleCode, title: rule.title }
    });
    
    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// 4️⃣ Propose a new version of an existing rule
exports.createRuleVersion = async (req, res) => {
  try {
    const { code } = req.params; // ruleCode of the base rule
    const base = await ComplianceRule.findOne({ ruleCode: code, status: 'ACTIVE' }).sort({ version: -1 });
    if (!base) return res.status(404).json({ success: false, error: 'Active base rule not found' });

    const { 
      regulatorySource, 
      reason, 
      effectiveDate, 
      applicabilityConditions,
      requiredEvidence,
      complianceFrequency,
      severity
    } = req.body;
    
    if (regulatorySource) {
      const src = await RegulatorySource.findById(regulatorySource);
      if (!src) return res.status(400).json({ success: false, error: 'Invalid regulatory source' });
      if (src.verificationStatus !== 'VERIFIED') {
        return res.status(400).json({ success: false, error: 'Source must be verified to propose a change' });
      }
    }

    if (!effectiveDate) {
      return res.status(400).json({ success: false, error: 'Effective date is required' });
    }

    const nextVersion = (parseFloat(base.version) + 0.1).toFixed(1);
    
    const proposal = new ProposedRuleChange({
      ruleCode: code,
      currentVersion: base.version,
      proposedVersion: nextVersion,
      proposedConditions: applicabilityConditions || base.applicabilityConditions,
      proposedEvidence: requiredEvidence || base.requiredEvidence,
      proposedSeverity: severity || base.severity,
      proposedFrequency: complianceFrequency || base.complianceFrequency,
      proposedSource: regulatorySource || base.regulatorySource,
      effectiveDate: effectiveDate,
      reason: reason || 'Version update',
      createdBy: req.user._id,
      status: 'PENDING'
    });
    
    await proposal.save();

    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: 'RULE_VERSION_PROPOSED',
      entity: 'ProposedRuleChange',
      entityId: proposal._id,
      newValue: { ruleCode: code, proposedVersion: nextVersion }
    });

    res.status(201).json({ success: true, data: proposal });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// 4.5 Approve a proposed rule change (Creates new active version)
exports.approveRuleChange = async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = await ProposedRuleChange.findById(id);
    if (!proposal) return res.status(404).json({ success: false, error: 'Proposal not found' });
    if (proposal.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Proposal already processed' });

    const base = await ComplianceRule.findOne({ ruleCode: proposal.ruleCode, version: proposal.currentVersion });
    if (!base) return res.status(404).json({ success: false, error: 'Base rule missing' });

    // Set expiry on old rule exactly to the new effective date to prevent overlap
    base.expiryDate = proposal.effectiveDate;
    await base.save();

    // Create the new active rule version
    const newRule = new ComplianceRule({
      ruleCode: base.ruleCode,
      title: base.title,
      description: base.description,
      complianceDomain: base.complianceDomain,
      jurisdictionLevel: base.jurisdictionLevel,
      state: base.state,
      district: base.district,
      industry: base.industry,
      subIndustry: base.subIndustry,
      regulator: base.regulator,
      applicabilityConditions: proposal.proposedConditions,
      requiredEvidence: proposal.proposedEvidence,
      complianceFrequency: proposal.proposedFrequency,
      severity: proposal.proposedSeverity,
      penaltyDescription: base.penaltyDescription,
      imprisonmentRisk: base.imprisonmentRisk,
      licenseSuspensionRisk: base.licenseSuspensionRisk,
      effectiveDate: proposal.effectiveDate,
      regulatorySource: proposal.proposedSource,
      version: proposal.proposedVersion,
      status: 'ACTIVE'
    });
    
    await newRule.save();

    proposal.status = 'APPROVED';
    proposal.reviewedBy = req.user._id;
    await proposal.save();
    
    await RuleVersion.create({
      ruleCode: base.ruleCode,
      versionNumber: proposal.proposedVersion,
      previousVersion: base.version,
      changes: proposal.reason,
      effectiveDate: proposal.effectiveDate,
      createdBy: req.user._id,
      sourceReference: proposal.proposedSource,
      active: true
    });

    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: 'RULE_VERSION_ACTIVATED',
      entity: 'ComplianceRule',
      entityId: newRule._id,
      previousValue: { version: base.version, expiryDate: base.expiryDate },
      newValue: { version: newRule.version, effectiveDate: newRule.effectiveDate }
    });

    res.status(200).json({ success: true, data: newRule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// 5️⃣ Update rule status (activate / deactivate / draft)
exports.updateRuleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // expected: ACTIVE, INACTIVE, DRAFT
    const rule = await ComplianceRule.findById(id).populate('regulatorySource');
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    if (!['ACTIVE', 'INACTIVE', 'DRAFT'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }
    
    // Activation checks
    if (status === 'ACTIVE') {
      if (!rule.regulatorySource) return res.status(400).json({ success: false, error: 'Regulatory source required for activation' });
      if (rule.regulatorySource.verificationStatus !== 'VERIFIED') {
         return res.status(400).json({ success: false, error: 'Source must be VERIFIED before activating rule' });
      }
      if (!rule.effectiveDate) return res.status(400).json({ success: false, error: 'Effective date required for activation' });
    }
    
    // Deactivation requires a reason
    if (status === 'INACTIVE' && !reason) {
      return res.status(400).json({ success: false, error: 'Deactivation reason required' });
    }
    
    const prevStatus = rule.status;
    rule.status = status;
    if (status === 'INACTIVE') rule.deactivationReason = reason;
    await rule.save();
    
    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: status === 'ACTIVE' ? 'RULE_ACTIVATED' : status === 'INACTIVE' ? 'RULE_DEACTIVATED' : 'RULE_UPDATED',
      entity: 'ComplianceRule',
      entityId: rule._id,
      previousValue: { status: prevStatus },
      newValue: { status: rule.status, reason }
    });

    res.status(200).json({ success: true, data: rule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// 6️⃣ Generic update (used for draft edits that don't create a new version)
exports.updateRule = async (req, res) => {
  try {
    const rule = await ComplianceRule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.status(200).json({ success: true, data: rule });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
