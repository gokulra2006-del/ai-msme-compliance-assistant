const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const ComplianceRule = require('../models/ComplianceRule');
const Business = require('../models/Business');
const Evidence = require('../models/Evidence');
const AuditLog = require('../models/AuditLog');

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
    const update = await RegulatoryUpdate.findById(id);
    if (!update) return res.status(404).json({ success: false, error: 'Update not found' });
    if (update.status !== 'VERIFIED') {
      return res.status(400).json({ success: false, error: 'Update must be VERIFIED before analysis' });
    }

    update.impactAnalysisStatus = 'ANALYZING';
    await update.save();

    // 1. Identify Affected Rules
    // Match based on state and industry. If update is generic (no state), match all.
    const ruleQuery = { status: 'ACTIVE' };
    if (update.affectedStates && update.affectedStates.length > 0) {
      ruleQuery.state = { $in: update.affectedStates };
    }
    if (update.affectedIndustries && update.affectedIndustries.length > 0) {
      ruleQuery.industry = { $in: update.affectedIndustries };
    }
    
    // In a full implementation, we'd check act/section if available, but matching state+industry is the core requirement
    const matchedRules = await ComplianceRule.find(ruleQuery);
    
    const affectedRules = matchedRules.map(rule => ({
      ruleId: rule._id,
      ruleCode: rule.ruleCode,
      title: rule.title,
      version: rule.version,
      matchReason: `Matched due to State=${rule.state || 'Any'} and Industry=${rule.industry || 'Any'}`,
      impactCategory: 'POSSIBLE'
    }));

    // 2. Identify Affected Businesses
    const businessQuery = {};
    if (update.affectedStates && update.affectedStates.length > 0) {
      businessQuery.state = { $in: update.affectedStates };
    }
    if (update.affectedIndustries && update.affectedIndustries.length > 0) {
      businessQuery.industry = { $in: update.affectedIndustries };
    }
    
    const matchedBusinesses = await Business.find(businessQuery).populate('user', 'name email');
    
    const affectedBusinesses = matchedBusinesses.map(b => ({
      businessId: b._id,
      name: b.user?.name || 'Unnamed Business',
      state: b.state,
      industry: b.industry,
      matchReason: `Matches State=${b.state} and Industry=${b.industry}`
    }));

    // 3. Identify Evidence Impact
    // For the matched businesses and matched rules, what required evidence might be affected?
    const requiredDocsSet = new Set();
    matchedRules.forEach(r => {
      if (r.requiredEvidence) {
        r.requiredEvidence.forEach(doc => requiredDocsSet.add(doc));
      }
    });
    const requiredDocs = Array.from(requiredDocsSet);

    // Fetch evidence for these businesses that matches the required docs
    const evidenceImpact = [];
    if (matchedBusinesses.length > 0 && requiredDocs.length > 0) {
      const businessIds = matchedBusinesses.map(b => b._id);
      const evidence = await Evidence.find({
        business: { $in: businessIds },
        documentType: { $in: requiredDocs }
      }).populate('business');
      
      evidence.forEach(ev => {
        evidenceImpact.push({
          evidenceId: ev._id,
          documentType: ev.documentType,
          businessName: ev.business?.user?.name || 'Unknown',
          currentStatus: ev.verificationStatus,
          reason: 'Related requirement may have changed'
        });
      });
    }

    const impactAnalysisResult = {
      affectedRules,
      affectedBusinesses,
      evidenceImpact,
      analyzedAt: new Date(),
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
        businessesCount: affectedBusinesses.length 
      }
    });

    res.status(200).json({ success: true, data: update });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
