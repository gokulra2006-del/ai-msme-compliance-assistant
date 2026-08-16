// backend/src/services/evidenceIntelligenceService.js
//
// Evidence Intelligence — the one place that answers:
//   "which documents does this business need, and what is the state of each?"
//
// The Evidence Vault dashboard, Inspection Readiness, Document Preparation,
// Submission Assistance, the Risk Engine and the AI context all call into this
// service, so none of them can disagree about a document's status.
//
// GROUNDING RULES (Prompt 16 §§9, 10, 31):
//   * Requirements are read ONLY from GAWK-derived records already in the
//     database — ComplianceRule.requiredEvidence and the ComplianceAction rows
//     the deterministic Rules Engine produced. Nothing here invents a document
//     type, an expiry period, or a regulatory requirement.
//   * The deterministic Rules Engine decides applicability. This service only
//     reports evidence state against what the engine already decided.
//   * Where a regulatory basis cannot be traced, the exact INSUFFICIENT_DATA
//     sentence is returned rather than an assumption.

const Business = require('../models/Business');
const Evidence = require('../models/Evidence');
const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const { evaluateRules } = require('../engine/rulesEngine');
const {
  INSUFFICIENT_DATA,
  EXPIRY_WARNING_DAYS,
  getExpiryStatus,
  daysUntilExpiry,
  normaliseDocType,
  resolveRequiredEvidenceState,
  satisfiesRequirement,
  buildTraceability,
  indexEvidenceForMatching,
  findEvidenceForRequirement
} = require('../utils/evidenceStatus');

// VERIFIED inside SurakshaSetu is a review decision by an authorised user. It is
// NOT an assertion that any government body has verified the document, and this
// notice travels with every payload that reports a verification status.
const VERIFICATION_MEANING =
  'VERIFIED means an authorised reviewer accepted this document inside SurakshaSetu. It does NOT mean a government authority has independently verified it.';

const EXTRACTION_MEANING =
  'Extracted values are automated readings of the uploaded file, not legal verification. Confirm or correct them before relying on them.';

/**
 * Resolves the business a user may act on. Supports both linkage directions the
 * codebase uses (User.business, and Business.user) so no caller has to guess.
 */
async function resolveBusinessForUser(user) {
  if (!user) return null;
  if (user.business) {
    const linked = await Business.findById(user.business);
    if (linked) return linked;
  }
  return Business.findOne({ user: user._id || user.id });
}

function loadActiveRules() {
  return ComplianceRule.find({ status: 'ACTIVE' }).populate('regulatorySource').lean();
}

/** Latest, non-archived evidence — the only versions that can satisfy a requirement. */
function activeEvidenceFilter(businessId) {
  return { business: businessId, isLatestVersion: { $ne: false }, archived: { $ne: true } };
}

/**
 * Builds the catalogue of required documents for a business.
 *
 * Two GAWK-derived sources are merged:
 *   1. ComplianceAction rows the Rules Engine persisted (carry due date/assignee)
 *   2. A live Rules Engine evaluation of ACTIVE ComplianceRules
 *
 * Neither is invented here. If a rule carries no requiredEvidence, no
 * requirement is manufactured for it.
 */
async function buildRequirementCatalogue(business) {
  const rules = await loadActiveRules();
  const rulesByCode = new Map(rules.map(rule => [rule.ruleCode, rule]));

  const evaluated = evaluateRules(business.toObject ? business.toObject() : business, rules);
  const applicable = evaluated.filter(item => item.applicability === 'APPLIES');
  const insufficientData = evaluated.filter(item => item.applicability === 'INSUFFICIENT_DATA');

  const actions = await ComplianceAction.find({ business: business._id, applicability: 'APPLIES' })
    .populate('assignedTo', 'name email role')
    .lean();

  const catalogue = new Map(); // `${obligationCode}::${normalisedDocType}`

  const add = (obligationCode, documentType, extra) => {
    if (!obligationCode || !documentType) return;
    const key = `${obligationCode}::${normaliseDocType(documentType)}`;
    const rule = rulesByCode.get(obligationCode);
    const existing = catalogue.get(key);
    if (existing) {
      // Merge the richer per-business detail from the persisted action.
      Object.entries(extra).forEach(([field, value]) => {
        if (value !== undefined && value !== null && existing[field] == null) existing[field] = value;
      });
      if (extra.requirementSource && !existing.requirementSources.includes(extra.requirementSource)) {
        existing.requirementSources.push(extra.requirementSource);
      }
      return;
    }
    catalogue.set(key, {
      key,
      obligationCode,
      obligationTitle: rule?.title || extra.obligationTitle || obligationCode,
      documentType,
      severity: rule?.severity || extra.severity || null,
      domain: rule?.complianceDomain || extra.domain || null,
      dueDate: extra.dueDate || null,
      assignedTo: extra.assignedTo || null,
      actionId: extra.actionId || null,
      actionStatus: extra.actionStatus || null,
      requirementSources: [extra.requirementSource].filter(Boolean),
      // Evidence -> Obligation -> Rule -> Regulatory Source -> GAWK reference
      traceability: buildTraceability({ rule, obligationCode })
    });
  };

  applicable.forEach(obligation => {
    (obligation.requiredEvidenceTypes || obligation.requiredEvidence || []).forEach(documentType => {
      add(obligation.code || obligation.ruleCode, documentType, {
        obligationTitle: obligation.obligationTitle || obligation.title,
        severity: obligation.severity,
        requirementSource: 'RULES_ENGINE'
      });
    });
  });

  actions.forEach(action => {
    (action.evidenceRequired || []).forEach(documentType => {
      add(action.ruleCode, documentType, {
        dueDate: action.dueDate,
        assignedTo: action.assignedTo,
        actionId: action._id,
        actionStatus: action.status,
        severity: action.priority,
        requirementSource: 'COMPLIANCE_ACTION'
      });
    });
  });

  return {
    requirements: [...catalogue.values()],
    rulesByCode,
    applicableCount: applicable.length,
    // Obligations the engine could not evaluate. Reported, never guessed at.
    insufficientData: insufficientData.map(item => ({
      obligationCode: item.code || item.ruleCode,
      obligationTitle: item.obligationTitle || item.title,
      missingFields: item.missingFields || [],
      note: INSUFFICIENT_DATA
    }))
  };
}

/** Compact, safe projection of an evidence record for requirement rows. */
function projectEvidence(evidence, now) {
  if (!evidence) return null;
  return {
    evidenceId: evidence._id,
    documentName: evidence.documentName,
    documentType: evidence.documentType,
    documentNumber: evidence.documentNumber || null,
    issuingAuthority: evidence.issuingAuthority || null,
    issueDate: evidence.issueDate || null,
    expiryDate: evidence.expiryDate || null,
    expiryStatus: getExpiryStatus(evidence.expiryDate, now),
    daysUntilExpiry: daysUntilExpiry(evidence.expiryDate, now),
    verificationStatus: evidence.verificationStatus,
    reviewStatus: evidence.reviewStatus,
    processingStatus: evidence.processingStatus,
    version: evidence.version,
    potentialIssueCount: (evidence.potentialIssues || []).length,
    uploadedAt: evidence.createdAt
  };
}

/**
 * Matches evidence to the requirement catalogue and resolves each row's state:
 * AVAILABLE / MISSING / EXPIRED / UNVERIFIED / UNDER_REVIEW / REJECTED.
 */
function buildEvidenceMatrix({ requirements, evidenceList, now = new Date() }) {
  const index = indexEvidenceForMatching(evidenceList);

  return requirements.map(requirement => {
    const { evidence, matchType, candidateCount } = findEvidenceForRequirement(
      index,
      requirement.obligationCode,
      requirement.documentType,
      now
    );

    // A same-type document filed under a different obligation is offered as a
    // suggestion for a human to confirm — it never silently satisfies a
    // requirement, so the row still reads MISSING until someone links it.
    const isLooseMatch = matchType === 'DOCUMENT_TYPE_ONLY';
    const state = isLooseMatch ? 'MISSING' : resolveRequiredEvidenceState(evidence, now);

    return {
      ...requirement,
      status: state,
      satisfied: satisfiesRequirement(state),
      evidence: isLooseMatch ? null : projectEvidence(evidence, now),
      suggestedEvidence: isLooseMatch
        ? { ...projectEvidence(evidence, now), filedUnderObligation: evidence.obligationCode, matchType }
        : null,
      matchType,
      candidateCount,
      // Kept flat for the existing UI columns.
      evidenceId: isLooseMatch ? null : evidence?._id || null,
      expiryDate: isLooseMatch ? null : evidence?.expiryDate || null,
      verificationStatus: isLooseMatch ? null : evidence?.verificationStatus || null,
      expiryStatus: isLooseMatch ? 'NOT_DETECTED' : getExpiryStatus(evidence?.expiryDate, now)
    };
  });
}

/**
 * Every metric here is counted from actual database records (Prompt 16 §27).
 * Nothing is hardcoded or estimated.
 */
function computeVaultSummary({ evidenceList, matrix, archivedCount = 0, now = new Date() }) {
  const countStatus = status => evidenceList.filter(ev => ev.verificationStatus === status).length;
  const expiryOf = ev => getExpiryStatus(ev.expiryDate, now);

  const documents = {
    total: evidenceList.length,
    verified: countStatus('VERIFIED'),
    underReview: countStatus('UNDER_REVIEW'),
    // Legacy PENDING records count as unverified — they were never reviewed.
    unverified: evidenceList.filter(ev => ['UNVERIFIED', 'PENDING'].includes(ev.verificationStatus)).length,
    rejected: countStatus('REJECTED'),
    expired: evidenceList.filter(ev => expiryOf(ev) === 'EXPIRED' || ev.verificationStatus === 'EXPIRED').length,
    expiringSoon: evidenceList.filter(ev => expiryOf(ev) === 'EXPIRING_SOON').length,
    noExpiryDetected: evidenceList.filter(ev => expiryOf(ev) === 'NOT_DETECTED').length,
    archived: archivedCount,
    withPotentialIssues: evidenceList.filter(ev => (ev.potentialIssues || []).length > 0).length,
    duplicatesFlagged: evidenceList.filter(ev => (ev.duplicateFlags || []).length > 0).length,
    extractionReviewed: evidenceList.filter(ev => ev.reviewStatus && ev.reviewStatus !== 'NOT_REVIEWED').length,
    awaitingExtractionReview: evidenceList.filter(
      ev => (ev.extractedFields || []).length > 0 && (!ev.reviewStatus || ev.reviewStatus === 'NOT_REVIEWED')
    ).length
  };

  const countState = state => matrix.filter(row => row.status === state).length;
  const requirements = {
    totalRequired: matrix.length,
    available: countState('AVAILABLE'),
    missing: countState('MISSING'),
    expired: countState('EXPIRED'),
    unverified: countState('UNVERIFIED'),
    underReview: countState('UNDER_REVIEW'),
    rejected: countState('REJECTED'),
    criticalGaps: matrix.filter(
      row => !row.satisfied && ['CRITICAL', 'HIGH'].includes(String(row.severity || '').toUpperCase())
    ).length
  };

  return {
    documents,
    requirements,
    expiryWarningDays: EXPIRY_WARNING_DAYS,
    // Legacy keys the existing Evidence Vault UI already reads. Kept so the
    // enhancement does not break the current page.
    totalRequired: requirements.totalRequired,
    uploaded: requirements.available,
    missing: requirements.missing,
    expiringSoon: matrix.filter(row => row.expiryStatus === 'EXPIRING_SOON').length,
    expired: requirements.expired,
    pendingVerification: requirements.unverified + requirements.underReview
  };
}

/**
 * Reports data-quality problems. It never deletes or "fixes" a record
 * (Prompt 16 §32) — every finding is for a human to act on.
 */
function buildDataQualityAudit({ evidenceList, allEvidence, matrix, rulesByCode, fileExists }) {
  const findings = [];
  const add = (issue, severity, description, records) => {
    if (!records.length) return;
    findings.push({ issue, severity, description, count: records.length, records });
  };

  const ref = ev => ({
    evidenceId: ev._id,
    documentName: ev.documentName,
    documentType: ev.documentType,
    obligationCode: ev.obligationCode || null
  });

  add('EVIDENCE_WITHOUT_BUSINESS', 'HIGH',
    'Evidence records with no owning business. Cannot be attributed or access-controlled.',
    allEvidence.filter(ev => !ev.business).map(ref));

  add('EVIDENCE_WITHOUT_OBLIGATION', 'MEDIUM',
    'Evidence not linked to any obligation code.',
    allEvidence.filter(ev => !ev.obligationCode).map(ref));

  add('ORPHANED_EVIDENCE', 'MEDIUM',
    'Evidence linked to an obligation code that is not an ACTIVE rule in the current ruleset.',
    allEvidence.filter(ev => ev.obligationCode && !rulesByCode.has(ev.obligationCode)).map(ref));

  add('OBLIGATION_MISSING_EVIDENCE', 'HIGH',
    'Applicable obligations whose required evidence has not been provided.',
    matrix.filter(row => row.status === 'MISSING').map(row => ({
      obligationCode: row.obligationCode,
      obligationTitle: row.obligationTitle,
      documentType: row.documentType,
      severity: row.severity
    })));

  add('EXPIRED_BUT_MARKED_VALID', 'HIGH',
    'Documents whose expiry date has passed but which are still marked VERIFIED.',
    evidenceList
      .filter(ev => ev.verificationStatus === 'VERIFIED' && getExpiryStatus(ev.expiryDate) === 'EXPIRED')
      .map(ev => ({ ...ref(ev), expiryDate: ev.expiryDate })));

  add('MISSING_VERIFICATION_STATUS', 'MEDIUM',
    'Records with no verification status set.',
    allEvidence.filter(ev => !ev.verificationStatus).map(ref));

  add('LEGACY_PENDING_STATUS', 'LOW',
    'Records still on the legacy PENDING status. They have never been reviewed.',
    allEvidence.filter(ev => ev.verificationStatus === 'PENDING').map(ref));

  add('MISSING_METADATA', 'LOW',
    'Latest documents with no document number, issuing authority or expiry date on record.',
    evidenceList
      .filter(ev => !ev.documentNumber && !ev.issuingAuthority && !ev.expiryDate)
      .map(ref));

  add('NO_EXPIRY_DETECTED', 'LOW',
    'Documents with no expiry date. Validity cannot be tracked — this is not proof of permanent validity.',
    evidenceList.filter(ev => !ev.expiryDate).map(ref));

  add('DUPLICATE_CANDIDATES', 'MEDIUM',
    'Documents flagged as possible duplicates. Flagged only — nothing was deleted.',
    evidenceList
      .filter(ev => (ev.duplicateFlags || []).some(flag => !flag.acknowledged))
      .map(ev => ({ ...ref(ev), reasons: ev.duplicateFlags.map(flag => flag.reason) })));

  add('BROKEN_FILE_REFERENCE', 'HIGH',
    'Records whose stored file is missing from disk.',
    allEvidence.filter(ev => !ev.filePath || !fileExists(ev.filePath)).map(ref));

  add('AWAITING_EXTRACTION_REVIEW', 'LOW',
    'Documents with automated extractions that no human has confirmed or corrected yet.',
    evidenceList
      .filter(ev => (ev.extractedFields || []).length > 0 && (!ev.reviewStatus || ev.reviewStatus === 'NOT_REVIEWED'))
      .map(ref));

  return {
    findings,
    totalFindings: findings.reduce((sum, finding) => sum + finding.count, 0),
    notice: 'Data quality findings are reported for human action only. No record was deleted or modified by this audit.'
  };
}

/**
 * The full Evidence Intelligence payload for a business.
 * @param {object} params
 * @param {object} params.business  Business document
 * @param {function} [params.fileExists] (filePath) => boolean, for the file-reference audit
 * @param {boolean} [params.includeDataQuality]
 */
async function getEvidenceIntelligence({ business, fileExists = () => true, includeDataQuality = false }) {
  const now = new Date();
  const { requirements, rulesByCode, insufficientData } = await buildRequirementCatalogue(business);

  const [evidenceList, archivedCount, allEvidence] = await Promise.all([
    Evidence.find(activeEvidenceFilter(business._id))
      .populate('uploadedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean(),
    Evidence.countDocuments({ business: business._id, $or: [{ archived: true }, { verificationStatus: 'ARCHIVED' }] }),
    includeDataQuality ? Evidence.find({ business: business._id }).lean() : Promise.resolve([])
  ]);

  const matrix = buildEvidenceMatrix({ requirements, evidenceList, now });
  const summary = computeVaultSummary({ evidenceList, matrix, archivedCount, now });

  const expiringEvidence = evidenceList
    .map(ev => ({ evidence: ev, status: getExpiryStatus(ev.expiryDate, now) }))
    .filter(item => item.status === 'EXPIRED' || item.status === 'EXPIRING_SOON')
    .map(item => ({
      evidenceId: item.evidence._id,
      documentName: item.evidence.documentName,
      documentType: item.evidence.documentType,
      obligationCode: item.evidence.obligationCode,
      expiryDate: item.evidence.expiryDate,
      daysUntilExpiry: daysUntilExpiry(item.evidence.expiryDate, now),
      status: item.status,
      verificationStatus: item.evidence.verificationStatus
    }))
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  return {
    summary,
    requiredDocuments: matrix,
    evidenceRecords: evidenceList,
    expiringEvidence,
    insufficientDataObligations: insufficientData,
    dataQuality: includeDataQuality
      ? buildDataQualityAudit({ evidenceList, allEvidence, matrix, rulesByCode, fileExists })
      : null,
    notices: {
      verification: VERIFICATION_MEANING,
      extraction: EXTRACTION_MEANING
    },
    generatedAt: now.toISOString()
  };
}

/**
 * Evidence status for a single obligation. Used by Document Preparation (§21),
 * Submission Assistance (§22) and the AI assistant so all three read the same
 * status the vault shows.
 */
async function getObligationEvidenceStatus({ business, obligationCode, requiredEvidence = null }) {
  const now = new Date();
  const rule = await ComplianceRule.findOne({
    ruleCode: obligationCode,
    status: { $nin: ['INACTIVE', 'EXPIRED', 'ARCHIVED'] }
  }).populate('regulatorySource').lean();

  const action = await ComplianceAction.findOne({ business: business._id, ruleCode: obligationCode }).lean();

  // Requirements come only from stored GAWK-derived records (or an explicit list
  // the caller already read from one). Never from an assumption.
  const documentTypes = [...new Set([
    ...(requiredEvidence || []),
    ...(rule?.requiredEvidence || []),
    ...(action?.evidenceRequired || [])
  ].filter(Boolean))];

  const evidenceList = await Evidence.find(activeEvidenceFilter(business._id)).lean();
  const traceability = buildTraceability({ rule, obligationCode });

  const requirements = documentTypes.map(documentType => ({
    key: `${obligationCode}::${normaliseDocType(documentType)}`,
    obligationCode,
    obligationTitle: rule?.title || obligationCode,
    documentType,
    severity: rule?.severity || null,
    requirementSources: ['RULES_ENGINE'],
    traceability
  }));

  const checklist = buildEvidenceMatrix({ requirements, evidenceList, now });

  return {
    obligationCode,
    obligationTitle: rule?.title || INSUFFICIENT_DATA,
    traceability,
    checklist,
    allSatisfied: checklist.length > 0 && checklist.every(row => row.satisfied),
    // No requirement on record is reported as such rather than as "compliant".
    hasRequirements: checklist.length > 0,
    noRequirementNotice: checklist.length === 0
      ? 'No required evidence is recorded for this obligation in the GAWK ruleset.'
      : null,
    missing: checklist.filter(row => row.status === 'MISSING').map(row => row.documentType),
    expired: checklist.filter(row => row.status === 'EXPIRED').map(row => row.documentType),
    unverified: checklist
      .filter(row => ['UNVERIFIED', 'UNDER_REVIEW'].includes(row.status))
      .map(row => row.documentType),
    rejected: checklist.filter(row => row.status === 'REJECTED').map(row => row.documentType),
    notices: { verification: VERIFICATION_MEANING }
  };
}

module.exports = {
  VERIFICATION_MEANING,
  EXTRACTION_MEANING,
  resolveBusinessForUser,
  activeEvidenceFilter,
  buildRequirementCatalogue,
  buildEvidenceMatrix,
  computeVaultSummary,
  buildDataQualityAudit,
  getEvidenceIntelligence,
  getObligationEvidenceStatus,
  projectEvidence
};
