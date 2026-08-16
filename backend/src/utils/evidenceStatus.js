// backend/src/utils/evidenceStatus.js
//
// Single source of truth for evidence status derivation.
//
// Every module that needs to answer "is this document available / expired /
// unverified?" uses these helpers so the Evidence Vault, Inspection Readiness,
// Document Preparation, Submission Assistance, Risk Engine and the AI context
// can never disagree with each other.
//
// GROUNDING RULE: nothing in this file invents a regulatory requirement, an
// expiry period, a document type, or a legal conclusion. Expiry is derived ONLY
// from a date that is already stored on the evidence record (entered by a user
// or read out of the document itself). Requirements are derived ONLY from
// requiredEvidence already present in the GAWK-derived ComplianceRule /
// ComplianceAction records.

const INSUFFICIENT_DATA = 'INSUFFICIENT_DATA — Not available in the GAWK ruleset.';

// Warning window for an approaching expiry date. This is a UI/reminder window,
// not a regulatory renewal period, and it matches the window already used by
// the existing reminder engine (complianceReminderJob EVIDENCE_EXPIRY_DAYS).
const EXPIRY_WARNING_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Derives expiry state from a stored expiry date only.
 * NOT_DETECTED means no expiry date is on record — it does NOT mean the
 * document never expires.
 * @returns {'EXPIRED'|'EXPIRING_SOON'|'VALID'|'NOT_DETECTED'}
 */
function getExpiryStatus(expiryDate, now = new Date()) {
  if (!expiryDate) return 'NOT_DETECTED';
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return 'NOT_DETECTED';
  const diff = expiry.getTime() - now.getTime();
  if (diff < 0) return 'EXPIRED';
  if (diff <= EXPIRY_WARNING_DAYS * DAY_MS) return 'EXPIRING_SOON';
  return 'VALID';
}

function daysUntilExpiry(expiryDate, now = new Date()) {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
}

/** Loose comparison key for document type names. */
function normaliseDocType(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Resolves the state of a single required document.
 *
 * Prompt 16 §10 states: AVAILABLE / MISSING / EXPIRED / UNVERIFIED.
 * REJECTED and UNDER_REVIEW are surfaced as their own states because the
 * existing review workflow already distinguishes them and collapsing them would
 * hide a reviewer decision.
 *
 * @returns {'MISSING'|'EXPIRED'|'REJECTED'|'UNDER_REVIEW'|'UNVERIFIED'|'AVAILABLE'}
 */
function resolveRequiredEvidenceState(evidence, now = new Date()) {
  if (!evidence) return 'MISSING';

  const expiryStatus = getExpiryStatus(evidence.expiryDate, now);

  // An expired document cannot satisfy a requirement, whatever its review state.
  if (expiryStatus === 'EXPIRED') return 'EXPIRED';
  if (evidence.verificationStatus === 'EXPIRED') return 'EXPIRED';
  if (evidence.verificationStatus === 'REJECTED') return 'REJECTED';
  if (evidence.verificationStatus === 'ARCHIVED') return 'MISSING';
  if (evidence.verificationStatus === 'VERIFIED') return 'AVAILABLE';
  if (evidence.verificationStatus === 'UNDER_REVIEW') return 'UNDER_REVIEW';

  // UPLOADED / UNVERIFIED / legacy PENDING: the file exists but no authorised
  // reviewer has accepted it inside SurakshaSetu yet.
  return 'UNVERIFIED';
}

/** A required document is only satisfied once a reviewer has accepted it. */
function satisfiesRequirement(state) {
  return state === 'AVAILABLE';
}

/**
 * Builds the GAWK traceability chain for a piece of evidence or a requirement:
 *   Evidence -> Obligation -> Compliance Rule -> Regulatory Source -> GAWK reference
 *
 * Any link that is not present in the stored GAWK-derived records is reported as
 * the exact INSUFFICIENT_DATA sentence. External legal knowledge is never used
 * to fill a gap.
 *
 * @param {object} params
 * @param {object} [params.rule]       ComplianceRule (lean or doc), optionally with regulatorySource populated
 * @param {object} [params.obligation] Obligation document, optionally with regulatorySource populated
 * @param {string} [params.obligationCode]
 */
function buildTraceability({ rule, obligation, obligationCode } = {}) {
  const source = rule?.regulatorySource || obligation?.regulatorySource || null;
  const sourceIsPopulated = source && typeof source === 'object' && !source._bsontype && (source.actName || source.sourceName);

  const code = rule?.ruleCode || obligation?.obligationCode || obligationCode || null;

  const actName = (sourceIsPopulated ? source.actName : null) || rule?.actName || obligation?.actName || null;
  const section = (sourceIsPopulated ? source.sectionNumber : null) || rule?.section || obligation?.section || null;
  const authority = (sourceIsPopulated ? source.regulator : null) || rule?.authority || rule?.regulator || obligation?.regulator || null;
  const officialUrl = (sourceIsPopulated ? source.officialUrl : null) || rule?.sourceUrl || null;
  const verificationStatus = (sourceIsPopulated ? source.verificationStatus : null) || rule?.verificationStatus || null;

  const complete = Boolean(code && actName);

  return {
    obligationCode: code || INSUFFICIENT_DATA,
    obligationTitle: rule?.title || obligation?.title || INSUFFICIENT_DATA,
    ruleCode: code || INSUFFICIENT_DATA,
    actName: actName || INSUFFICIENT_DATA,
    section: section || INSUFFICIENT_DATA,
    authority: authority || INSUFFICIENT_DATA,
    officialUrl: officialUrl || null,
    sourceVerificationStatus: verificationStatus || INSUFFICIENT_DATA,
    // The regulatory basis for every rule in this deployment is the GAWK
    // reference document. We report the chain, we never assert a legal outcome.
    gawkReference: complete
      ? `GAWK ruleset — ${code}${section ? ` (${section})` : ''}`
      : INSUFFICIENT_DATA,
    traceabilityComplete: complete
  };
}

/**
 * Picks the single most relevant evidence record for a required document type.
 * Prefers an accepted, unexpired document; otherwise the most recently created.
 */
function pickBestEvidence(candidates, now = new Date()) {
  if (!candidates || candidates.length === 0) return null;
  const rank = ev => {
    const state = resolveRequiredEvidenceState(ev, now);
    if (state === 'AVAILABLE') return 0;
    if (state === 'UNDER_REVIEW') return 1;
    if (state === 'UNVERIFIED') return 2;
    if (state === 'EXPIRED') return 3;
    return 4; // REJECTED / MISSING
  };
  return [...candidates].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  })[0];
}

/**
 * Indexes evidence for requirement matching. Only the latest, non-archived
 * version of a document is ever used to satisfy a requirement so superseded
 * versions cannot mask or inflate a status.
 */
function indexEvidenceForMatching(evidenceList) {
  const byKey = new Map();      // `${obligationCode}::${normalisedDocType}`
  const byDocType = new Map();  // normalisedDocType (obligation-agnostic fallback)

  const active = (evidenceList || [])
    .filter(ev => ev.isLatestVersion !== false && !ev.archived && ev.verificationStatus !== 'ARCHIVED');

  active.forEach(ev => {
    const docKey = normaliseDocType(ev.documentType);
    const key = `${ev.obligationCode || ''}::${docKey}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(ev);
    if (!byDocType.has(docKey)) byDocType.set(docKey, []);
    byDocType.get(docKey).push(ev);
  });

  // `active` is returned so callers that need to walk every current document
  // (e.g. the expiry pass in the Risk Engine) use the same exclusion rules.
  return { byKey, byDocType, active };
}

/**
 * Finds the evidence that answers a requirement. An exact obligation+type match
 * wins; a same-type document filed under another obligation is offered as a
 * weaker match so the reviewer can decide, and is marked as such.
 */
function findEvidenceForRequirement(index, obligationCode, documentType, now = new Date()) {
  const docKey = normaliseDocType(documentType);
  const exact = index.byKey.get(`${obligationCode || ''}::${docKey}`);
  if (exact && exact.length) {
    return { evidence: pickBestEvidence(exact, now), matchType: 'EXACT', candidateCount: exact.length };
  }
  const loose = index.byDocType.get(docKey);
  if (loose && loose.length) {
    return { evidence: pickBestEvidence(loose, now), matchType: 'DOCUMENT_TYPE_ONLY', candidateCount: loose.length };
  }
  return { evidence: null, matchType: 'NONE', candidateCount: 0 };
}

module.exports = {
  INSUFFICIENT_DATA,
  EXPIRY_WARNING_DAYS,
  getExpiryStatus,
  daysUntilExpiry,
  normaliseDocType,
  resolveRequiredEvidenceState,
  satisfiesRequirement,
  buildTraceability,
  pickBestEvidence,
  indexEvidenceForMatching,
  findEvidenceForRequirement
};
