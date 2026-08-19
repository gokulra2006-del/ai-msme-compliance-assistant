const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const ComplianceRule = require('../models/ComplianceRule');
const Business = require('../models/Business');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');
const rulesEngine = require('../engine/rulesEngine');

exports.getUpdateDetails = async (req, res) => {
  try {
    const update = await RegulatoryUpdate.findById(req.params.id).populate('source');
    if (!update) return res.status(404).json({ success: false, error: 'Update not found' });
    res.status(200).json({ success: true, data: update });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.analyzeImpact = async (req, res) => {
  try {
    const { id } = req.params;
    const update = await RegulatoryUpdate.findById(id).populate('source');
    if (!update) return res.status(404).json({ success: false, error: 'Update not found' });
    if (update.status !== 'VERIFIED') {
      return res.status(400).json({ success: false, error: 'Update must be VERIFIED before analysis' });
    }

    update.impactAnalysisStatus = 'ANALYZING';
    await update.save();

    // 1. Identify Candidate Rules
    const ruleQuery = { status: 'ACTIVE' };
    if (update.affectedRuleCodes && update.affectedRuleCodes.length > 0) {
      ruleQuery.ruleCode = { $in: update.affectedRuleCodes };
    } else {
      if (update.affectedStates && update.affectedStates.length > 0) {
        ruleQuery.state = { $in: update.affectedStates };
      }
      if (update.affectedIndustries && update.affectedIndustries.length > 0) {
        ruleQuery.industry = { $in: update.affectedIndustries };
      }
    }
    
    const matchedRules = await ComplianceRule.find(ruleQuery);
    
    const affectedRules = matchedRules.map(rule => ({
      ruleId: rule._id,
      ruleCode: rule.ruleCode,
      title: rule.title,
      version: rule.version,
      matchReason: `Scope match`,
      impactCategory: 'MODIFIED',
      sourceAct: rule.regulatorySource?.actName || update.source?.actName || 'Not available in the Suraksha Rules engine.'
    }));

    // 2. Identify Affected Businesses
    const businessQuery = {};
    if (update.affectedStates && update.affectedStates.length > 0) {
      businessQuery.state = { $in: update.affectedStates };
    }
    if (update.affectedIndustries && update.affectedIndustries.length > 0) {
      businessQuery.industry = { $in: update.affectedIndustries };
    }
    
    const matchedBusinesses = await Business.find(businessQuery).populate('user', 'name email role');
    
    const affectedBusinesses = [];
    const evidenceImpact = [];

    let totalHighRisk = 0;
    let totalDocChanges = 0;
    let totalDeadlineChanges = 0;

    // Simulate Before vs After for each business
    for (const b of matchedBusinesses) {
      const beforeEval = rulesEngine.evaluateRules(b, matchedRules);
      
      const modifiedRules = matchedRules.map(r => {
        const clonedRule = { ...r.toObject() };
        if (update.newRequirement) {
          if (update.newRequirement.applicabilityConditions) {
            clonedRule.applicabilityConditions = { ...clonedRule.applicabilityConditions, ...update.newRequirement.applicabilityConditions };
          }
          if (update.newRequirement.requiredEvidence) {
            clonedRule.requiredEvidence = update.newRequirement.requiredEvidence;
          }
          if (update.newRequirement.complianceFrequency) {
            clonedRule.complianceFrequency = update.newRequirement.complianceFrequency;
          }
          if (update.newRequirement.severity) {
            clonedRule.severity = update.newRequirement.severity;
          }
        }
        return clonedRule;
      });

      const afterEval = rulesEngine.evaluateRules(b, modifiedRules);

      for (let i = 0; i < beforeEval.length; i++) {
        const before = beforeEval[i];
        const after = afterEval[i];

        let isAffected = false;
        let impactReason = '';
        let requiredAction = '';
        let actionList = [];
        let beforeStatusStr = before.status;
        let afterStatusStr = after.status;
        let deadlineImpact = null;
        let docImpact = false;

        if (before.status !== 'APPLIES' && after.status === 'APPLIES') {
          isAffected = true;
          impactReason = `New obligation applies due to threshold/applicability change.`;
          actionList.push(`Review new obligation: ${after.title}`);
          if (after.requiredEvidenceTypes?.length > 0) {
             actionList.push(`Prepare required document: ${after.requiredEvidenceTypes.join(', ')}`);
             docImpact = true;
          }
        } else if (before.status === 'APPLIES' && after.status !== 'APPLIES') {
          isAffected = true;
          impactReason = `Obligation no longer applies.`;
          actionList.push(`Archive previous obligation`);
        } else if (before.status === 'APPLIES' && after.status === 'APPLIES') {
          if (before.cadence !== after.cadence) {
            isAffected = true;
            impactReason = `Filing frequency changed from ${before.cadence || 'N/A'} to ${after.cadence || 'N/A'}.`;
            actionList.push(`Update compliance calendar to ${after.cadence}`);
            deadlineImpact = { old: before.cadence, new: after.cadence };
            totalDeadlineChanges++;
          }
          const beforeEvStr = (before.requiredEvidenceTypes || []).join(',');
          const afterEvStr = (after.requiredEvidenceTypes || []).join(',');
          if (beforeEvStr !== afterEvStr) {
            isAffected = true;
            impactReason = `Required documents changed.`;
            const addedDocs = (after.requiredEvidenceTypes || []).filter(x => !(before.requiredEvidenceTypes || []).includes(x));
            if (addedDocs.length > 0) {
              actionList.push(`Prepare new document: ${addedDocs.join(', ')}`);
            }
            actionList.push(`Upload required evidence for validation`);
            docImpact = true;
            totalDocChanges++;
            
            evidenceImpact.push({
              businessId: b._id,
              businessName: b.user?.name || 'Unknown',
              oldDocuments: before.requiredEvidenceTypes,
              newDocuments: after.requiredEvidenceTypes,
              ruleCode: after.ruleCode,
              reason: 'Required documents modified by regulation change'
            });
          }
        }

        if (isAffected) {
          const rDelta = (after.severity === 'CRITICAL' ? 20 : 10) - (before.severity === 'CRITICAL' ? 20 : 10);
          if (rDelta > 0) totalHighRisk++;
          
          requiredAction = actionList.join('; ');

          affectedBusinesses.push({
            businessId: b._id,
            name: b.user?.name || 'Unnamed Business',
            state: b.state,
            industry: b.industry,
            affectedRule: after.ruleCode,
            ruleName: after.title,
            beforeStatus: beforeStatusStr,
            afterStatus: afterStatusStr,
            impactReason,
            requiredAction,
            actionList,
            deadlineImpact,
            docImpact,
            riskDelta: rDelta
          });
        }
      }
    }

    const uniqueStates = [...new Set(matchedBusinesses.map(b => b.state).filter(Boolean))];
    const uniqueIndustries = [...new Set(matchedBusinesses.map(b => b.industry).filter(Boolean))];

    const impactAnalysisResult = {
      affectedRules,
      affectedBusinesses,
      evidenceImpact,
      summary: {
        totalBusinesses: affectedBusinesses.length,
        affectedStatesCount: uniqueStates.length,
        affectedStates: uniqueStates,
        affectedIndustriesCount: uniqueIndustries.length,
        affectedIndustries: uniqueIndustries,
        totalHighRisk,
        totalDocChanges,
        totalDeadlineChanges
      },
      analyzedAt: new Date(),
      totalBusinessesScanned: matchedBusinesses.length
    };

    update.impactAnalysisResult = impactAnalysisResult;
    update.impactAnalysisStatus = 'ANALYZED';
    await update.save();

    await AuditLog.create({
      user: req.user._id,
      actorRole: 'ADMIN',
      action: 'REGULATORY_UPDATE_ANALYSIS_COMPLETED',
      entity: 'RegulatoryUpdate',
      entityId: update._id,
      metadata: { 
        rulesCount: affectedRules.length, 
        businessesAffected: affectedBusinesses.length,
        totalScanned: matchedBusinesses.length
      }
    });

    res.status(200).json({ success: true, data: update });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
