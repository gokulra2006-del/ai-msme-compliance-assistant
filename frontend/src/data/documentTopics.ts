/**
 * Documents & Compliance Evidence — question/topic definitions.
 *
 * GROUNDING (read this before editing)
 * ------------------------------------
 * No regulation, obligation, document type or requirement is declared in this
 * file. Every topic is a *predicate* over the requirement rows that
 * `GET /api/evidence/dashboard` already returns.
 *
 * Those rows are built by backend/src/services/evidenceIntelligenceService.js,
 * which states its own grounding rules: requirements come only from
 * GAWK-derived records already in the database — `ComplianceRule.requiredEvidence`
 * and the `ComplianceAction` rows the deterministic Rules Engine produced.
 * Every seeded rule carries `sourceMetadata.officialUrl: 'NOT AVAILABLE IN GAWK'`
 * and a `traceability.gawkReference`, so the chain back to GAWK is in the data.
 *
 * Consequences of building the questions this way:
 *   - A topic with no matching rows is not rendered, so a question can never be
 *     shown that the underlying ruleset does not support.
 *   - Add, edit or remove a GAWK rule and the questions change by themselves.
 *     There is no list of questions to maintain in lockstep with the ruleset.
 *   - The four "kind" groups partition the whole catalogue; whatever they do not
 *     claim falls to `OTHER`, which is appended last and cannot drift.
 *
 * The keyword lists below are deliberately generic (licence, return, register,
 * certificate...). They group the document *names the ruleset itself uses* and
 * encode no opinion about what any law requires.
 */

/** The backend's sentinel for a fact it will not guess at. Shown verbatim. */
export const INSUFFICIENT_DATA = 'INSUFFICIENT_DATA — Not available in the GAWK ruleset.';

export const isInsufficient = (value?: string | null): boolean =>
  !value || value === INSUFFICIENT_DATA || value.startsWith('INSUFFICIENT_DATA');

/** Evidence → Obligation → Rule → Regulatory Source → GAWK, as the backend builds it. */
export interface Traceability {
  obligationCode: string;
  obligationTitle: string;
  ruleCode: string;
  actName: string;
  section: string;
  authority: string;
  officialUrl: string | null;
  sourceVerificationStatus: string;
  gawkReference: string;
  traceabilityComplete: boolean;
}

/** The uploaded file behind a requirement, as `projectEvidence` returns it. */
export interface EvidenceProjection {
  evidenceId?: string;
  documentName?: string;
  documentType?: string;
  documentNumber?: string | null;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  expiryStatus?: string | null;
  daysUntilExpiry?: number | null;
  verificationStatus?: string | null;
  version?: number | null;
  uploadedAt?: string | null;
}

/** One row of `dashboard.requiredDocuments`. Field names mirror the API exactly. */
export interface EvidenceRow {
  key: string;
  obligationCode: string;
  obligationTitle: string;
  documentType: string;
  severity?: string | null;
  domain?: string | null;
  /** The rule's stated cadence ("Annual", "Monthly"). Null when it states none. */
  complianceFrequency?: string | null;
  dueDate?: string | null;
  /** MISSING | EXPIRED | REJECTED | UNDER_REVIEW | UNVERIFIED | AVAILABLE */
  status: string;
  satisfied?: boolean;
  /** VALID | EXPIRING_SOON | EXPIRED | NOT_DETECTED — separate from `status`. */
  expiryStatus?: string | null;
  verificationStatus?: string | null;
  expiryDate?: string | null;
  evidenceId?: string | null;
  evidence?: EvidenceProjection | null;
  requirementSources?: string[];
  traceability?: Traceability | null;
}

/* ============================================================
   Kind classification — a strict partition of the catalogue
   ============================================================ */

export type DocumentKind = 'LICENCE' | 'FILING' | 'REGISTER' | 'CERTIFICATE' | 'UNGROUPED';

/**
 * Tested in this order, first match wins, so a row lands in exactly one kind.
 * Order matters where a name carries two words: "ESIC Registration Certificate"
 * is a registration before it is a certificate.
 */
const KIND_KEYWORDS: Array<{ kind: DocumentKind; keywords: string[] }> = [
  {
    kind: 'LICENCE',
    keywords: ['licence', 'license', 'registration', 'authorisation', 'authorization', 'permit', 'consent to operate', 'cto']
  },
  {
    kind: 'FILING',
    keywords: ['return', 'filing', 'challan', 'form']
  },
  {
    kind: 'REGISTER',
    keywords: ['register', 'record', 'log', 'muster', 'ledger']
  },
  {
    kind: 'CERTIFICATE',
    keywords: ['certificate', 'report', 'test', 'approval', 'clearance', 'fitness', 'stability', 'audit']
  }
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Word-start anchored with a free suffix: "return" matches "Returns", not "overturn". */
const compiled = KIND_KEYWORDS.map(entry => ({
  kind: entry.kind,
  patterns: entry.keywords.map(keyword => new RegExp(`\\b${escapeRegex(keyword)}`, 'i'))
}));

export const classifyKind = (row: EvidenceRow): DocumentKind => {
  const name = [row.documentType, row.evidence?.documentName].filter(Boolean).join(' ');
  if (!name) return 'UNGROUPED';
  for (const entry of compiled) {
    if (entry.patterns.some(pattern => pattern.test(name))) return entry.kind;
  }
  return 'UNGROUPED';
};

/* ============================================================
   Topics
   ============================================================ */

export const OTHER_TOPIC_ID = 'OTHER';

export interface DocumentTopic {
  id: string;
  /** The user-facing question. */
  question: string;
  /** Short label for breadcrumbs and back buttons. */
  shortLabel: string;
  icon: string;
  /** Sits under the question on the results screen. States where the data came from. */
  blurb: string;
  matches: (row: EvidenceRow) => boolean;
  /** Rendered even with a count of zero. Everything else self-hides when empty. */
  alwaysShow?: boolean;
}

const TOPICS: DocumentTopic[] = [
  {
    id: 'ALL',
    question: 'What documents does my business need?',
    shortLabel: 'All documents',
    icon: '📄',
    blurb: 'Every document the applicable rules require, with the state of each.',
    matches: () => true
  },
  {
    id: 'LICENCE',
    question: 'Which licences and registrations must I hold?',
    shortLabel: 'Licences & registrations',
    icon: '📜',
    blurb: 'Requirements whose evidence is a licence, registration or authorisation.',
    matches: row => classifyKind(row) === 'LICENCE'
  },
  {
    id: 'FILING',
    question: 'Which returns, filings and challans need evidence?',
    shortLabel: 'Returns & filings',
    icon: '🧾',
    blurb: 'Requirements satisfied by a filed return, challan or payment record.',
    matches: row => classifyKind(row) === 'FILING'
  },
  {
    id: 'REGISTER',
    question: 'Which registers and records must I maintain?',
    shortLabel: 'Registers & records',
    icon: '📋',
    blurb: 'Requirements satisfied by a maintained register, record or log.',
    matches: row => classifyKind(row) === 'REGISTER'
  },
  {
    id: 'CERTIFICATE',
    question: 'Which certificates and test reports are required?',
    shortLabel: 'Certificates & reports',
    icon: '✅',
    blurb: 'Requirements satisfied by a certificate, approval or test report.',
    matches: row => classifyKind(row) === 'CERTIFICATE'
  },
  {
    id: 'MISSING',
    question: 'Which documents am I missing?',
    shortLabel: 'Missing documents',
    icon: '⚠️',
    blurb: 'Requirements with no document on file that satisfies them yet.',
    matches: row => row.status === 'MISSING'
  },
  {
    id: 'RENEWAL',
    question: 'Which documents need renewal?',
    shortLabel: 'Renewals',
    icon: '🔄',
    blurb: 'Documents on file that have expired or are inside the expiry window.',
    matches: row =>
      row.status === 'EXPIRED' || row.expiryStatus === 'EXPIRED' || row.expiryStatus === 'EXPIRING_SOON'
  },
  {
    id: 'HIGH_RISK',
    question: 'Which documents carry the highest penalty risk?',
    shortLabel: 'Highest penalty risk',
    icon: '🔍',
    blurb: 'Requirements the ruleset marks CRITICAL or HIGH severity.',
    matches: row => row.severity === 'CRITICAL' || row.severity === 'HIGH'
  },
  {
    id: 'DEADLINE',
    question: 'Which documents have a deadline?',
    shortLabel: 'Deadlines',
    icon: '📅',
    blurb: 'Requirements the Rules Engine attached a due date to.',
    matches: row => Boolean(row.dueDate)
  }
];

const OTHER_TOPIC: DocumentTopic = {
  id: OTHER_TOPIC_ID,
  question: 'Other',
  shortLabel: 'Other',
  icon: '⋯',
  blurb: 'Required documents that fall outside the groups above.',
  matches: row => classifyKind(row) === 'UNGROUPED'
};

/**
 * Render order. "Other" is appended rather than listed inline, so it is
 * structurally last and cannot drift into the middle when topics are edited.
 */
export const DOCUMENT_TOPICS: DocumentTopic[] = [...TOPICS, OTHER_TOPIC];

/* ============================================================
   Derivations used by the UI
   ============================================================ */

export interface ObligationGroup {
  obligationCode: string;
  obligationTitle: string;
  domain?: string | null;
  severity?: string | null;
  complianceFrequency?: string | null;
  traceability?: Traceability | null;
  rows: EvidenceRow[];
}

/**
 * Groups a topic's rows by obligation, preserving catalogue order, so the
 * results screen can read Obligation → Required Evidence.
 *
 * Uploads that satisfy no requirement carry no obligation code. They are
 * collected under one group and labelled as unlinked rather than being given a
 * guessed obligation.
 */
export const UNLINKED_GROUP_CODE = 'UNLINKED';

export const groupByObligation = (rows: EvidenceRow[]): ObligationGroup[] => {
  const groups = new Map<string, ObligationGroup>();
  rows.forEach(row => {
    const code = row.obligationCode || UNLINKED_GROUP_CODE;
    let group = groups.get(code);
    if (!group) {
      group = {
        obligationCode: code,
        obligationTitle:
          row.obligationTitle ||
          (row.obligationCode ? row.obligationCode : 'Documents you uploaded'),
        domain: row.domain ?? null,
        severity: row.severity ?? null,
        complianceFrequency: row.complianceFrequency ?? null,
        traceability: row.traceability ?? null,
        rows: []
      };
      groups.set(code, group);
    }
    group.rows.push(row);
  });
  return [...groups.values()];
};

/**
 * "Why is this document required?" — assembled strictly from the traceability
 * chain the backend supplied. Returns null when the chain is incomplete, so the
 * UI can show the backend's own INSUFFICIENT_DATA sentence instead of prose.
 */
export const buildWhyRequired = (row: EvidenceRow): string | null => {
  const trace = row.traceability;
  if (!trace || !trace.traceabilityComplete) return null;

  const obligation = isInsufficient(trace.obligationTitle) ? row.obligationTitle : trace.obligationTitle;
  const parts = [`Required as evidence for ${obligation} (${trace.obligationCode}).`];

  if (!isInsufficient(trace.actName)) {
    parts.push(isInsufficient(trace.section)
      ? `Applicable rule: ${trace.actName}.`
      : `Applicable rule: ${trace.actName}, ${trace.section}.`);
  }
  if (!isInsufficient(trace.authority)) parts.push(`Enforced by ${trace.authority}.`);

  return parts.join(' ');
};

/* ============================================================
   Search
   ============================================================ */

/**
 * The fields a search query is tested against — the document's own name and the
 * verified metadata already attached to it. Nothing is generated for the index,
 * so a query can only ever match text the ruleset or the user's upload supplied.
 */
const searchableText = (row: EvidenceRow): string =>
  [
    row.documentType,
    row.obligationTitle,
    row.obligationCode,
    row.domain,
    row.complianceFrequency,
    row.evidence?.documentName,
    row.evidence?.documentType,
    row.evidence?.documentNumber,
    row.evidence?.issuingAuthority,
    row.traceability?.ruleCode,
    row.traceability?.actName,
    row.traceability?.section,
    row.traceability?.authority
  ]
    .filter((value): value is string => typeof value === 'string' && value !== '' && !isInsufficient(value))
    .join(' ')
    .toLowerCase();

/**
 * Every whitespace-separated term must appear somewhere in the row, so adding a
 * word narrows the result set rather than widening it.
 */
export const searchRows = (rows: EvidenceRow[], query: string): EvidenceRow[] => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return rows;
  return rows.filter(row => {
    const haystack = searchableText(row);
    return terms.every(term => haystack.includes(term));
  });
};
