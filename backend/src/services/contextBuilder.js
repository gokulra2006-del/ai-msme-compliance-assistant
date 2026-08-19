const Business = require('../models/Business');
const Evidence = require('../models/Evidence');
const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const RegulatorySubmission = require('../models/RegulatorySubmission');
const SimulationHistory = require('../models/SimulationHistory');
const RegulatoryUpdate = require('../models/RegulatoryUpdate');
const RuleVersion = require('../models/RuleVersion');
const { calculateRiskScore } = require('../engine/riskScoring');
const { evaluateRules } = require('../engine/rulesEngine');
const EvidenceIntelligence = require('../services/evidenceIntelligenceService');
const inspectionService = require('../services/inspectionService');
const { getExpiryStatus, daysUntilExpiry, INSUFFICIENT_DATA } = require('../utils/evidenceStatus');

exports.buildContext = async (businessId, userQuestion, simulationId = null) => {
  const business = await Business.findById(businessId).lean();
  if (!business) return null;

  // 1. Gather all active rules & evaluations
  const allRules = await ComplianceRule.find({ status: 'ACTIVE' }).populate('regulatorySource').lean();
  const evaluated = evaluateRules(business, allRules);

  // Filter for applicable or missing data
  const relevantObligations = evaluated.filter(e => e.applicability === 'APPLIES' || e.applicability === 'INSUFFICIENT_DATA');

  // 2. Gather Evidence. Only the current, non-archived version of each document
  // is sent to the assistant — a superseded file must never be described as the
  // document the business currently holds.
  const evidenceList = await Evidence.find(EvidenceIntelligence.activeEvidenceFilter(businessId)).lean();

  // 2.5 Required-evidence status, read from the same shared service the Evidence
  // Vault uses, so the assistant cannot state a different status than the UI.
  const evidenceIntelligence = await EvidenceIntelligence.getEvidenceIntelligence({ business });

  // 3. Gather Actions
  const actions = await ComplianceAction.find({ business: businessId, applicability: { $ne: 'DOES_NOT_APPLY' } }).lean();

  // 3.5 Gather Submissions
  const submissions = await RegulatorySubmission.find({ business: businessId }).lean();

  // 4. Gather Risk Score Breakdown
  const riskData = await calculateRiskScore(businessId);
  
  // 4.5 Gather Inspection Readiness Context
  let inspectionReadinessContext = null;
  try {
    const ir = await inspectionService.getInspectionReadiness(businessId);
    inspectionReadinessContext = {
      readinessScore: ir.readinessScore,
      status: ir.readinessStatus,
      criticalGaps: ir.criticalGaps,
      missingDocumentsCount: ir.metrics.missingCount,
      expiredDocumentsCount: ir.metrics.expiredCount
    };
  } catch (err) {
    console.error("Failed to load inspection readiness for AI context:", err);
  }

  // 5. Gather Upcoming/Recent Regulatory Updates that might affect this business
  let relevantUpdates = [];
  try {
    const updates = await RegulatoryUpdate.find({ status: { $in: ['VERIFIED', 'APPROVED', 'EFFECTIVE'] } }).populate('source').lean();
    
    // Filter to those that affect this business's industry or state (or all)
    relevantUpdates = updates.filter(u => {
      const stateMatch = !u.affectedStates || u.affectedStates.length === 0 || u.affectedStates.includes(business.state);
      const indMatch = !u.affectedIndustries || u.affectedIndustries.length === 0 || u.affectedIndustries.includes(business.industry);
      return stateMatch && indMatch;
    }).map(u => {
      // Find specific impacts for this business from impact analysis if available
      const bizImpact = u.impactAnalysisResult?.affectedBusinesses?.find((b) => b.businessId?.toString() === businessId.toString());
      
      return {
        title: u.title,
        description: u.description,
        status: u.status,
        effectiveDate: u.effectiveDate,
        source: {
          actName: u.source?.actName || INSUFFICIENT_DATA,
          authority: u.source?.authority || INSUFFICIENT_DATA
        },
        businessImpact: bizImpact ? {
          affectedRule: bizImpact.affectedRule,
          impactReason: bizImpact.impactReason,
          requiredAction: bizImpact.requiredAction,
          riskDelta: bizImpact.riskDelta
        } : 'No direct business impact found in analysis',
        changeType: u.changeType || 'OTHER',
        proposedChanges: u.proposedChanges
      };
    });
  } catch (err) {
    console.error("Failed to load regulatory updates for AI context:", err);
  }

  const now = new Date();

  // Instead of sending the full DB which is too large, we map down to exactly what the AI needs to answer questions securely

  const baseContext = {
    businessProfile: {
      industry: business.industry,
      state: business.state,
      totalWorkers: business.totalWorkers,
      contractWorkers: business.contractWorkers,
      factoryStatus: business.factoryStatus,
      // exclude sensitive private info like GSTIN string, owner name, etc.
    },
    inspectionReadiness: inspectionReadinessContext,
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
    submissions: submissions.map(sub => ({
      authority: sub.authority,
      submissionStatus: sub.submissionStatus,
      officialPortalUrl: sub.officialPortalUrl,
      startedAt: sub.startedAt,
      submittedAt: sub.submittedAt,
      queries: sub.queries?.length || 0
    })),
    evidenceVault: evidenceList.map(ev => ({
      documentType: ev.documentType,
      obligationCode: ev.obligationCode,
      expiryDate: ev.expiryDate,
      expiryStatus: getExpiryStatus(ev.expiryDate, now),
      daysUntilExpiry: daysUntilExpiry(ev.expiryDate, now),
      verificationStatus: ev.verificationStatus,
      isCurrentVersion: ev.isLatestVersion !== false && !ev.archived,
      documentIntelligence: {
        classification: ev.classification?.documentType || 'UNKNOWN',
        classificationConfidence: ev.classification?.confidence || 0,
        // Everything in this block was read from the uploaded file. It is the
        // DOCUMENT'S OWN CONTENT, never a regulatory requirement.
        informationSource: 'DOCUMENT_CONTENT_NOT_REGULATORY_REQUIREMENT',
        textExtractionStatus: ev.extraction?.status || 'NOT_ATTEMPTED',
        ocrStatus: ev.ocrStatus || 'NOT_APPLICABLE',
        extractedFields: (ev.extractedFields || []).map(field => ({
          field: field.field,
          value: field.correctedValue || field.value || 'NOT DETECTED',
          confidence: field.confidence ?? null,
          source: field.source || 'UNKNOWN',
          manuallyCorrected: Boolean(field.correctedValue)
        })),
        potentialIssues: ev.potentialIssues || [],
        missingInformation: ev.missingInformation || [],
        reviewStatus: ev.reviewStatus || 'NOT_REVIEWED',
        possibleObligation: ev.obligationMatch?.status === 'POSSIBLE_MATCH'
          ? { code: ev.obligationMatch.obligationCode, confidence: ev.obligationMatch.confidence }
          : null
      }
    })),
    // Required-evidence status. Requirements come ONLY from the Suraksha Rules-derived
    // ruleset — this list is a REGULATORY REQUIREMENT read from stored records,
    // which is a different kind of fact from the document contents above.
    evidenceRequirements: {
      informationSource: 'Suraksha Rules_DERIVED_RULESET',
      summary: evidenceIntelligence.summary,
      requirements: evidenceIntelligence.requiredDocuments.map(row => ({
        obligationCode: row.obligationCode,
        obligationTitle: row.obligationTitle,
        documentType: row.documentType,
        status: row.status,
        satisfied: row.satisfied,
        expiryStatus: row.expiryStatus,
        expiryDate: row.expiryDate,
        // Evidence -> Obligation -> Rule -> Regulatory Source -> Suraksha Rules reference
        traceability: {
          actName: row.traceability?.actName || INSUFFICIENT_DATA,
          section: row.traceability?.section || INSUFFICIENT_DATA,
          authority: row.traceability?.authority || INSUFFICIENT_DATA,
          surakshaRulesReference: row.traceability?.surakshaRulesReference || INSUFFICIENT_DATA
        }
      })),
      expiringEvidence: evidenceIntelligence.expiringEvidence,
      // Obligations whose regulatory detail is not in the ruleset. The assistant
      // must report this sentence rather than fill the gap from outside
      // knowledge.
      insufficientDataObligations: evidenceIntelligence.insufficientDataObligations
    },
    evidenceGroundingRules: {
      verificationMeaning: EvidenceIntelligence.VERIFICATION_MEANING,
      extractionMeaning: EvidenceIntelligence.EXTRACTION_MEANING,
      whenRequirementUnknown: INSUFFICIENT_DATA,
      constraints: [
        'Never state that a document is legally valid or legally invalid. Describe it as a POTENTIAL ISSUE at most.',
        'Never invent a required document type, an expiry period, a document field, or a government requirement.',
        'Never claim a document was read if the extraction status is NO_TEXT_LAYER, OCR_NOT_AVAILABLE, or FAILED.',
        'A missing expiry date means EXPIRY — NOT DETECTED. It never means the document is permanently valid.',
        'The deterministic Rules Engine decides which obligations apply. Do not add or remove obligations.'
      ]
    },
    currentRisk: {
      score: riskData.score,
      level: riskData.riskLevel,
      factors: riskData.factors,
      recommendedActions: riskData.recommendedActions
    },
    upcomingRegulatoryChanges: relevantUpdates,
    regulatoryChangeGroundingRules: {
      constraints: [
        'Use ONLY the data in upcomingRegulatoryChanges to explain regulatory updates.',
        'DO NOT invent amendments, penalties, deadlines, affected businesses, or legal consequences.',
        'If asked about a penalty or change consequence not explicitly listed, respond with "INSUFFICIENT_DATA — Not available in the Suraksha Rules engine."',
        'Always cite the Source, Act, and Effective Date when describing a change.',
        'Do not assume a change affects the business if businessImpact says "No direct business impact found in analysis".'
      ]
    }
  };

  if (simulationId) {
    const simulation = await SimulationHistory.findById(simulationId).lean();
    if (simulation && simulation.business.toString() === businessId.toString()) {
      baseContext.simulationData = {
        simulatedChanges: simulation.simulatedChanges,
        simulatedProfile: simulation.simulatedProfileSnapshot,
        newObligations: simulation.results.newRules,
        removedObligations: simulation.results.removedRules,
        changedObligations: simulation.results.changedObligations,
        riskImpact: {
          delta: simulation.results.riskDelta,
          drivers: simulation.results.riskDrivers
        },
        evidenceImpact: simulation.results.evidenceImpact,
        calendarImpact: simulation.results.calendarImpact
      };
    }
  }

  return baseContext;
};
