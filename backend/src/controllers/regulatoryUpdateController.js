const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const ComplianceRule = require('../models/ComplianceRule');
const RuleVersion = require('../models/RuleVersion');
const ComplianceAction = require('../models/ComplianceAction');
const AuditLog = require('../models/AuditLog');
const ComplianceReminder = require('../models/ComplianceReminder');

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

exports.getDashboardMetrics = async (req, res) => {
  try {
    const allUpdates = await RegulatoryUpdate.find().lean();
    
    const counts = {
      TOTAL: allUpdates.length,
      DRAFT: 0,
      UNDER_REVIEW: 0,
      VERIFIED: 0,
      APPROVED: 0,
      EFFECTIVE: 0,
      REJECTED: 0
    };
    
    let totalBusinessesAffected = 0;
    let totalRulesAffected = 0;
    let totalHighImpact = 0;
    
    const upcoming = [];

    for (const u of allUpdates) {
      if (counts[u.status] !== undefined) counts[u.status]++;
      
      if (u.impactAnalysisResult && u.impactAnalysisResult.summary) {
        totalBusinessesAffected += u.impactAnalysisResult.summary.totalBusinesses || 0;
        totalRulesAffected += u.impactAnalysisResult.affectedRules?.length || 0;
        totalHighImpact += u.impactAnalysisResult.summary.totalHighRisk || 0;
      }

      if (['APPROVED', 'VERIFIED'].includes(u.status) && u.effectiveDate) {
        const today = new Date();
        const effDate = new Date(u.effectiveDate);
        if (effDate >= today) {
          const daysRemaining = Math.ceil((effDate - today) / (1000 * 60 * 60 * 24));
          upcoming.push({
            _id: u._id,
            title: u.title,
            effectiveDate: u.effectiveDate,
            daysRemaining,
            affectedRulesCount: u.impactAnalysisResult?.affectedRules?.length || 0,
            affectedBusinessesCount: u.impactAnalysisResult?.summary?.totalBusinesses || 0
          });
        }
      }
    }
    
    upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.status(200).json({
      success: true,
      data: {
        counts,
        impact: {
          totalBusinessesAffected,
          totalRulesAffected,
          totalHighImpact
        },
        upcoming
      }
    });
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
    
    const update = await RegulatoryUpdate.findById(req.params.id);
    if (!update) return res.status(404).json({ success: false, error: 'Regulatory update not found' });

    const prevStatus = update.status;
    update.status = status;
    update.reviewedBy = req.user._id;
    if (reviewNotes) update.reviewNotes = reviewNotes;
    
    // Approval Workflow Logic
    if (status === 'APPROVED') {
      if (update.impactAnalysisStatus !== 'ANALYZED' || !update.impactAnalysisResult) {
        return res.status(400).json({ success: false, error: 'Cannot approve update without running impact analysis first.' });
      }

      const { affectedRules, affectedBusinesses } = update.impactAnalysisResult;
      
      // Phase 7: Rule Versioning & Modification
      for (const affectedRule of affectedRules) {
        const rule = await ComplianceRule.findById(affectedRule.ruleId);
        if (rule) {
          // Archive old version
          await RuleVersion.create({
            ruleCode: rule.ruleCode,
            versionNumber: rule.version.toString(),
            changes: `Archived before applying update: ${update.title}`,
            effectiveDate: update.effectiveDate || new Date(),
            createdBy: req.user._id,
            sourceReference: update._id
          });

          // Apply changes to active rule
          if (update.newRequirement) {
            if (update.newRequirement.applicabilityConditions) {
              rule.applicabilityConditions = { ...rule.applicabilityConditions, ...update.newRequirement.applicabilityConditions };
            }
            if (update.newRequirement.requiredEvidence) {
              rule.requiredEvidence = update.newRequirement.requiredEvidence;
            }
            if (update.newRequirement.complianceFrequency) {
              rule.complianceFrequency = update.newRequirement.complianceFrequency;
            }
            if (update.newRequirement.severity) {
              rule.severity = update.newRequirement.severity;
            }
          }
          rule.version = rule.version + 1;
          await rule.save();
        }
      }

      // Phase 8-15: Actions & Notifications for Affected Businesses
      const businessMap = new Map();
      for (const biz of affectedBusinesses) {
        // Prevent spam by grouping by business
        if (!businessMap.has(biz.businessId)) {
          businessMap.set(biz.businessId, []);
        }
        businessMap.get(biz.businessId).push(biz);
        
        // Generate new compliance action for the affected obligation
        await ComplianceAction.create({
          business: biz.businessId,
          ruleCode: biz.affectedRule,
          title: `Action Required: Regulatory Change (${biz.affectedRule})`,
          description: `This obligation was affected by regulatory update: ${update.title}. Reason: ${biz.impactReason}. Action: ${biz.requiredAction}`,
          priority: biz.riskDelta > 0 ? 'CRITICAL' : 'HIGH',
          dueDate: update.effectiveDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
          status: 'PENDING',
          sourceUpdate: update._id
        });
      }

      // Send Notifications
      for (const [businessId, impacts] of businessMap.entries()) {
        try {
          await ComplianceReminder.create({
            business: businessId,
            action: impacts[0].businessId, // just placeholder
            title: 'Important Regulatory Change',
            message: `A new regulatory update (${update.title}) affects your business. You have ${impacts.length} new compliance actions required.`,
            priority: 'HIGH',
            status: 'PENDING',
            dueDate: update.effectiveDate || new Date()
          });
        } catch (e) {
          console.warn('Failed to send notification for business', businessId, e.message);
        }
      }
    }
    
    await update.save();

    let auditAction = `REGULATORY_UPDATE_${status}`;
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
