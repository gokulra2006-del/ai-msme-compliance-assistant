const Business = require('../models/Business');
const Evidence = require('../models/Evidence');
const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const { calculateRiskScore } = require('../engine/riskScoring');
const { evaluateRules } = require('../engine/rulesEngine');

exports.buildContext = async (businessId, userQuestion) => {
  const business = await Business.findById(businessId).lean();
  if (!business) return null;

  // 1. Gather all active rules & evaluations
  const allRules = await ComplianceRule.find({ active: true }).lean();
  const evaluated = evaluateRules(business, allRules);
  
  // Filter for applicable or missing data
  const relevantObligations = evaluated.filter(e => e.applicability === 'APPLIES' || e.applicability === 'INSUFFICIENT_DATA');

  // 2. Gather Evidence
  const evidenceList = await Evidence.find({ business: businessId }).lean();
  
  // 3. Gather Actions
  const actions = await ComplianceAction.find({ business: businessId, applicability: { $ne: 'DOES_NOT_APPLY' } }).lean();

  // 4. Gather Risk Score Breakdown
  const riskData = await calculateRiskScore(businessId);

  // Instead of sending the full DB which is too large, we map down to exactly what the AI needs to answer questions securely
  
  return {
    businessProfile: {
      industry: business.industry,
      state: business.state,
      totalWorkers: business.totalWorkers,
      contractWorkers: business.contractWorkers,
      factoryStatus: business.factoryStatus,
      // exclude sensitive private info like GSTIN string, owner name, etc.
    },
    applicableObligations: relevantObligations.map(obl => ({
      ruleCode: obl.ruleCode,
      title: obl.obligationTitle,
      status: obl.applicability,
      explanation: obl.explanation, // From the deterministic rules engine
      regulatorySource: obl.regulatorySource
    })),
    complianceActions: actions.map(act => ({
      title: act.title,
      category: act.category,
      priority: act.priority,
      status: act.status || (act.completionDate ? 'COMPLETED' : (!act.dueDate ? 'ON_TRACK' : (new Date(act.dueDate) < new Date() ? 'OVERDUE' : 'PENDING'))),
      dueDate: act.dueDate
    })),
    evidenceVault: evidenceList.map(ev => ({
      documentType: ev.documentType,
      obligationCode: ev.obligationCode,
      expiryDate: ev.expiryDate,
      verificationStatus: ev.verificationStatus,
      documentIntelligence: {
        classification: ev.classification?.documentType || 'UNKNOWN',
        classificationConfidence: ev.classification?.confidence || 0,
        extractedFields: (ev.extractedFields || []).map(field => ({
          field: field.field,
          value: field.correctedValue || field.value,
          confidence: field.confidence || 0,
          manuallyCorrected: Boolean(field.correctedValue)
        })),
        possibleObligation: ev.obligationMatch?.status === 'POSSIBLE_MATCH'
          ? { code: ev.obligationMatch.obligationCode, confidence: ev.obligationMatch.confidence }
          : null
      }
    })),
    currentRisk: {
      score: riskData.score,
      level: riskData.riskLevel,
      factors: riskData.factors,
      recommendedActions: riskData.recommendedActions
    }
  };
};
