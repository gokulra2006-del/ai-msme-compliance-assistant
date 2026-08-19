const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const Evidence = require('../models/Evidence');
const {
  getExpiryStatus,
  indexEvidenceForMatching,
  findEvidenceForRequirement,
  resolveRequiredEvidenceState
} = require('../utils/evidenceStatus');

// Weights Config
const WEIGHTS = {
  CRITICAL_OBLIGATION: 15,
  HIGH_OBLIGATION: 10,
  IMPRISONMENT_RISK: 20,
  LICENSE_SUSPENSION_RISK: 20,
  OVERDUE_ACTION: 25,
  MISSING_EVIDENCE: 20,
  EXPIRED_EVIDENCE: 20,
  DUE_SOON_ACTION: 5,
  EXPIRING_SOON_EVIDENCE: 5,
  INSUFFICIENT_DATA: 5,
  // A document that exists but has not been accepted by a reviewer is a smaller
  // risk than a missing one, but it is not the same as being satisfied.
  UNVERIFIED_EVIDENCE: 5,
  // A critical obligation with no evidence on file at all.
  CRITICAL_OBLIGATION_NO_EVIDENCE: 10
};

/**
 * Deterministically calculates the compliance risk score for a business.
 * @param {ObjectId} businessId
 * @returns {Object} Score details
 */
async function calculateRiskScore(businessId) {
  let rawScore = 0;
  const factors = [];
  const drivers = [];
  let recommendedActions = [];

  // Fetch relevant data
  const actions = await ComplianceAction.find({ business: businessId }).populate('obligationId');
  const evidences = await Evidence.find({ business: businessId });

  // Grouped counters
  let overdueActionsCount = 0;
  let dueSoonActionsCount = 0;
  let criticalObligationsCount = 0;
  let missingEvidenceCount = 0;
  let expiredEvidenceCount = 0;
  let insufficientDataCount = 0;
  let unverifiedEvidenceCount = 0;
  let criticalWithoutEvidenceCount = 0;

  const now = new Date();

  // Superseded and archived documents are excluded from every evidence check
  // below, so a replaced or archived file can never satisfy — or inflate the risk
  // of — a current requirement. The same helper the Evidence Vault uses is
  // applied here, so the two can never disagree about a document's state.
  const evidenceIndex = indexEvidenceForMatching(evidences);
  const activeEvidence = evidenceIndex.active;

  // 1. Analyze Compliance Actions and Obligations
  for (const action of actions) {
    if (action.applicability === 'INSUFFICIENT_DATA') {
      insufficientDataCount++;
      continue; // Skip further evaluation for insufficient data
    }

    if (action.applicability !== 'APPLIES') continue;

    // Severity
    if (action.priority === 'CRITICAL') criticalObligationsCount++;

    // Specific legal risks from the populated rule
    const rule = action.obligationId;
    if (rule) {
      if (rule.imprisonmentRisk) {
        rawScore += WEIGHTS.IMPRISONMENT_RISK;
        drivers.push(`High legal risk: Imprisonment penalty associated with ${rule.title}`);
      }
      if (rule.licenseSuspensionRisk) {
        rawScore += WEIGHTS.LICENSE_SUSPENSION_RISK;
        drivers.push(`High legal risk: License suspension penalty associated with ${rule.title}`);
      }
    }

    // Action Timeliness (only if not completed)
    if (!action.completionDate && action.dueDate) {
      const due = new Date(action.dueDate);
      if (due < now) {
        overdueActionsCount++;
        recommendedActions.push(`Complete overdue action: ${action.title}`);
      } else {
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
          dueSoonActionsCount++;
        }
      }
    }

    // Required Evidence Check.
    // The list of required documents comes only from the Suraksha Rules-derived record the
    // Rules Engine produced — nothing here invents a document requirement.
    if (action.evidenceRequired && action.evidenceRequired.length > 0) {
      let obligationHasAnyEvidence = false;

      for (const requiredType of action.evidenceRequired) {
        const match = findEvidenceForRequirement(evidenceIndex, action.ruleCode, requiredType, now);
        // A document filed under a different obligation is not counted here — the
        // Evidence Vault offers it as a suggestion for a human to link instead.
        const state = match.matchType === 'EXACT'
          ? resolveRequiredEvidenceState(match.evidence, now)
          : 'MISSING';

        if (state === 'MISSING' || state === 'REJECTED') {
          missingEvidenceCount++;
          recommendedActions.push(`Upload missing document: ${requiredType} for ${action.title}`);
        } else if (state === 'EXPIRED') {
          // Counted once in the expiry pass below so it is not double-charged.
          obligationHasAnyEvidence = true;
        } else if (state === 'UNVERIFIED' || state === 'UNDER_REVIEW') {
          unverifiedEvidenceCount++;
          obligationHasAnyEvidence = true;
          recommendedActions.push(`Get ${requiredType} reviewed for ${action.title}`);
        } else {
          obligationHasAnyEvidence = true;
        }
      }

      if (action.priority === 'CRITICAL' && !obligationHasAnyEvidence) {
        criticalWithoutEvidenceCount++;
        drivers.push(`Critical obligation with no evidence on file: ${action.title}`);
      }
    }
  }

  // 2. Analyze Existing Evidence (Expired / Expiring Soon).
  // Expiry is only read from a date stored on the record. A document with no
  // detected expiry date is never assumed to be permanently valid, and is never
  // counted as expired either.
  for (const ev of activeEvidence) {
    if (ev.verificationStatus === 'REJECTED') continue;
    const expiryStatus = getExpiryStatus(ev.expiryDate, now);
    if (expiryStatus === 'EXPIRED') {
      expiredEvidenceCount++;
      recommendedActions.push(`Renew expired document: ${ev.documentName}`);
    } else if (expiryStatus === 'EXPIRING_SOON') {
      rawScore += WEIGHTS.EXPIRING_SOON_EVIDENCE;
      drivers.push(`Document expiring soon: ${ev.documentName}`);
      recommendedActions.push(`Prepare renewal for: ${ev.documentName}`);
    }
  }

  // 3. Tally Grouped Counters into Factors
  if (criticalObligationsCount > 0) {
    const contribution = criticalObligationsCount * WEIGHTS.CRITICAL_OBLIGATION;
    rawScore += contribution;
    factors.push({
      factor: 'CRITICAL_OBLIGATIONS',
      count: criticalObligationsCount,
      contribution,
      explanation: `${criticalObligationsCount} critical applicable obligation(s) require attention.`
    });
    drivers.push(`${criticalObligationsCount} critical obligation(s)`);
  }

  if (overdueActionsCount > 0) {
    const contribution = overdueActionsCount * WEIGHTS.OVERDUE_ACTION;
    rawScore += contribution;
    factors.push({
      factor: 'OVERDUE_ACTIONS',
      count: overdueActionsCount,
      contribution,
      explanation: `${overdueActionsCount} compliance action(s) are overdue.`
    });
    drivers.push(`${overdueActionsCount} overdue compliance action(s)`);
  }

  if (dueSoonActionsCount > 0) {
    const contribution = dueSoonActionsCount * WEIGHTS.DUE_SOON_ACTION;
    rawScore += contribution;
    factors.push({
      factor: 'DUE_SOON_ACTIONS',
      count: dueSoonActionsCount,
      contribution,
      explanation: `${dueSoonActionsCount} compliance action(s) are due within 30 days.`
    });
  }

  if (missingEvidenceCount > 0) {
    const contribution = missingEvidenceCount * WEIGHTS.MISSING_EVIDENCE;
    rawScore += contribution;
    factors.push({
      factor: 'MISSING_EVIDENCE',
      count: missingEvidenceCount,
      contribution,
      explanation: `${missingEvidenceCount} required compliance document(s) are missing.`
    });
    drivers.push(`${missingEvidenceCount} missing required document(s)`);
  }

  if (expiredEvidenceCount > 0) {
    const contribution = expiredEvidenceCount * WEIGHTS.EXPIRED_EVIDENCE;
    rawScore += contribution;
    factors.push({
      factor: 'EXPIRED_EVIDENCE',
      count: expiredEvidenceCount,
      contribution,
      explanation: `${expiredEvidenceCount} compliance document(s) have expired.`
    });
    drivers.push(`${expiredEvidenceCount} expired document(s)`);
  }

  if (unverifiedEvidenceCount > 0) {
    const contribution = unverifiedEvidenceCount * WEIGHTS.UNVERIFIED_EVIDENCE;
    rawScore += contribution;
    factors.push({
      factor: 'UNVERIFIED_EVIDENCE',
      count: unverifiedEvidenceCount,
      contribution,
      explanation: `${unverifiedEvidenceCount} required document(s) are uploaded but have not been accepted by a reviewer inside SurakshaSetu.`
    });
    drivers.push(`${unverifiedEvidenceCount} document(s) awaiting internal review`);
  }

  if (criticalWithoutEvidenceCount > 0) {
    const contribution = criticalWithoutEvidenceCount * WEIGHTS.CRITICAL_OBLIGATION_NO_EVIDENCE;
    rawScore += contribution;
    factors.push({
      factor: 'CRITICAL_OBLIGATION_NO_EVIDENCE',
      count: criticalWithoutEvidenceCount,
      contribution,
      explanation: `${criticalWithoutEvidenceCount} critical obligation(s) have no supporting document on file at all.`
    });
  }

  if (insufficientDataCount > 0) {
    const contribution = insufficientDataCount * WEIGHTS.INSUFFICIENT_DATA;
    rawScore += contribution;
    factors.push({
      factor: 'INSUFFICIENT_DATA',
      count: insufficientDataCount,
      contribution,
      explanation: `Missing profile information prevents evaluation of ${insufficientDataCount} rule(s).`
    });
  }

  // 4. Normalize Score
  let finalScore = rawScore;
  if (finalScore > 100) finalScore = 100;
  if (finalScore < 0) finalScore = 0;

  // 5. Determine Risk Level
  let riskLevel = 'LOW';
  if (finalScore >= 71) riskLevel = 'CRITICAL';
  else if (finalScore >= 41) riskLevel = 'HIGH';
  else if (finalScore >= 21) riskLevel = 'MODERATE';

  // Sort recommended actions to prioritize the most important ones, and limit to 3.
  // Since we pushed overdue actions and missing evidence first, they are naturally higher priority.
  // We can deduplicate just in case.
  recommendedActions = [...new Set(recommendedActions)].slice(0, 3);
  if (recommendedActions.length === 0) {
    recommendedActions.push("No immediate risk-reduction action identified.");
  }

  // Limit drivers to top 5
  const topDrivers = [...new Set(drivers)].slice(0, 5);

  const breakdown = {
    operations: Math.min(100, Math.round((missingEvidenceCount * 20) + (expiredEvidenceCount * 20) + (unverifiedEvidenceCount * 5))),
    legal: Math.min(100, Math.round((criticalObligationsCount * 20) + (insufficientDataCount * 5) + (criticalWithoutEvidenceCount * 10))),
    financial: Math.min(100, Math.round((overdueActionsCount * 25) + (dueSoonActionsCount * 5)))
  };

  return {
    score: finalScore,
    riskLevel,
    calculatedAt: new Date().toISOString(),
    factors,
    riskDrivers: topDrivers,
    recommendedActions,
    insufficientDataWarning: insufficientDataCount > 0,
    breakdown
  };
}

module.exports = { calculateRiskScore, WEIGHTS };
