/**
 * Document categories for the Assistant's Documents browser.
 *
 * Categories are reference data only — they group the compliance documents the
 * backend already returns (`/api/evidence/dashboard` requirements and
 * `/api/evidence` uploads). Nothing here invents a document or a requirement.
 *
 * Matching order vs. display order are deliberately separate:
 *   - `DOCUMENT_CATEGORIES` is the order the cards are rendered in.
 *   - `priority` is the order categories are *tested* in, lowest first.
 *
 * Subject categories (GST, Labour, Environmental...) are tested before generic
 * document-form ones (Licences, Certificates, Returns) so a GST challan lands
 * under "GST & Taxation" rather than "Returns, Filings & Challans". Reorder by
 * editing `priority` alone — the rendered rows do not move.
 */

export interface DocumentCategory {
  id: string;
  label: string;
  icon: string;
  /** Test order, lowest first. Ties are resolved by array position. */
  priority: number;
  /** Word-start keyword prefixes tested against a document's text fields. */
  keywords: string[];
  /** Exact `complianceDomain` values from the rule engine that map here. */
  domains?: string[];
  /** Obligation code prefixes, e.g. "GST" matches GST-001. */
  codes?: string[];
}

/** Any document that matches no category above lands here. Always rendered last. */
export const OTHER_CATEGORY_ID = 'OTHER';

const SUBJECT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'BUSINESS_REGISTRATION',
    label: 'Business Registration & Incorporation',
    icon: '🏢',
    priority: 80,
    keywords: [
      'incorporation', 'memorandum', 'articles of association', 'moa', 'aoa',
      'partnership deed', 'llp', 'proprietorship', 'entity registration',
      'business registration', 'trade name', 'commencement of business'
    ]
  },
  {
    id: 'MSME_UDYAM',
    label: 'MSME & Udyam',
    icon: '📋',
    priority: 10,
    keywords: ['udyam', 'udyog aadhaar', 'udyog aadhar', 'msme', 'ssi registration'],
    codes: ['UDYAM', 'MSME']
  },
  {
    id: 'GST_TAXATION',
    label: 'GST & Taxation',
    icon: '🧾',
    priority: 20,
    keywords: ['gst', 'gstin', 'gstr', 'eway', 'e-way', 'input tax', 'hsn', 'cgst', 'sgst', 'igst'],
    domains: ['Tax & GST'],
    codes: ['GST']
  },
  {
    id: 'INCOME_TAX',
    label: 'Income Tax',
    icon: '💰',
    priority: 30,
    keywords: ['income tax', 'itr', 'tds', 'tcs', 'form 16', '26as', 'advance tax', 'pan'],
    codes: ['ITR', 'TDS', 'IT-']
  },
  {
    id: 'LABOUR_EMPLOYMENT',
    label: 'Labour & Employment',
    icon: '👥',
    priority: 40,
    keywords: [
      'epf', 'epfo', 'esic', 'esi', 'provident fund', 'gratuity', 'bonus',
      'wage', 'salary', 'payroll', 'muster', 'attendance', 'labour', 'labor',
      'employee', 'employment', 'clra', 'ecr', 'contractor'
    ],
    domains: ['Labour'],
    codes: ['EPF', 'ESIC', 'CLRA', 'LABOUR']
  },
  {
    id: 'SHOPS_ESTABLISHMENT',
    label: 'Shops & Establishment',
    icon: '🏪',
    priority: 60,
    keywords: ['shop', 'establishment', 'gumasta', 'gumastha', 'trade licence', 'trade license'],
    codes: ['SHOP', 'SNE']
  },
  {
    id: 'LICENCES_REGISTRATIONS',
    label: 'Licences & Registrations',
    icon: '📜',
    // Generic document-form bucket — tested after every subject category.
    priority: 100,
    keywords: ['licence', 'license', 'registration', 'permit', 'renewal', 'noc', 'authorisation', 'authorization']
  },
  {
    id: 'FINANCIAL_BANKING',
    label: 'Financial & Banking',
    icon: '🏦',
    priority: 90,
    keywords: [
      'bank', 'cheque', 'check', 'loan', 'sanction letter', 'balance sheet',
      'profit and loss', 'financial statement', 'audited', 'insurance',
      'invoice', 'ledger', 'mandate'
    ]
  },
  {
    id: 'COMPANY_CORPORATE',
    label: 'Company & Corporate Compliance',
    icon: '🏛️',
    priority: 70,
    keywords: [
      'roc', 'mca', 'aoc-4', 'mgt-7', 'din', 'board resolution', 'agm',
      'annual general meeting', 'company secretary', 'share certificate',
      'shareholding', 'statutory register'
    ],
    codes: ['ROC', 'MCA']
  },
  {
    id: 'ENVIRONMENTAL_SAFETY',
    label: 'Environmental & Safety',
    icon: '🌱',
    priority: 50,
    keywords: [
      'pollution', 'consent to operate', 'cto', 'effluent', 'emission',
      'hazardous', 'epr', 'plastic waste', 'environment', 'fire', 'safety',
      'boiler', 'factory', 'fssai', 'fostac', 'food safety', 'lab test',
      'cold storage', 'temperature log'
    ],
    domains: ['Environmental', 'Factory Safety', 'Food Safety'],
    codes: ['MPCB', 'CPCB', 'PLASTIC', 'FACTORY', 'BOILER', 'FSSAI', 'COLD']
  },
  {
    id: 'CERTIFICATES_APPROVALS',
    label: 'Certificates & Approvals',
    icon: '✅',
    // Generic document-form bucket.
    priority: 110,
    keywords: ['certificate', 'approval', 'clearance', 'attestation', 'fitness', 'stability', 'sanction']
  },
  {
    id: 'RETURNS_FILINGS',
    label: 'Returns, Filings & Challans',
    icon: '📤',
    // Generic document-form bucket.
    priority: 120,
    keywords: ['return', 'filing', 'challan', 'annexure', 'acknowledgement', 'acknowledgment', 'receipt', 'form ']
  },
  {
    id: 'POLICIES_AGREEMENTS',
    label: 'Policies, Agreements & Internal Documents',
    icon: '📁',
    // Generic document-form bucket.
    priority: 130,
    keywords: [
      'policy', 'agreement', 'contract', 'mou', 'sop', 'lease', 'rent',
      'deed', 'undertaking', 'declaration', 'affidavit', 'register',
      'log record', 'internal', 'minutes'
    ]
  }
];

const OTHER_CATEGORY: DocumentCategory = {
  id: OTHER_CATEGORY_ID,
  label: 'Other',
  icon: '🗂️',
  // Never tested — `resolveDocumentCategory` falls through to it.
  priority: Number.MAX_SAFE_INTEGER,
  keywords: []
};

/**
 * Render order. "Other" is appended here rather than listed inline, so it can
 * never drift into the middle of the grid when categories are added or edited.
 */
export const DOCUMENT_CATEGORIES: DocumentCategory[] = [...SUBJECT_CATEGORIES, OTHER_CATEGORY];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Anchored at a word start with a free suffix: "gst" also matches "gstin" and
 * "gstr-3b", while "shop" does not match "workshop".
 */
const keywordPattern = (keyword: string) => new RegExp(`\\b${escapeRegex(keyword)}`, 'i');

// Compiled once at module load, in test order.
const MATCHERS = SUBJECT_CATEGORIES
  .map((category, index) => ({
    id: category.id,
    order: [category.priority, index] as [number, number],
    domains: (category.domains || []).map(domain => domain.trim().toLowerCase()),
    codes: (category.codes || []).map(code => code.toUpperCase()),
    patterns: category.keywords.map(keywordPattern)
  }))
  .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1]);

export interface CategorisableDocument {
  documentType?: string | null;
  documentName?: string | null;
  obligationCode?: string | null;
  obligationTitle?: string | null;
  /** `complianceDomain` from the matching rule, when the backend supplied one. */
  domain?: string | null;
}

/**
 * Resolves the single category a document belongs to. Every document resolves
 * to exactly one id, so per-category counts always sum to the document total.
 */
export const resolveDocumentCategory = (doc: CategorisableDocument): string => {
  const haystack = [doc.documentType, doc.documentName, doc.obligationTitle]
    .filter(Boolean)
    .join(' ');
  const domain = (doc.domain || '').trim().toLowerCase();
  const code = (doc.obligationCode || '').trim().toUpperCase();

  for (const matcher of MATCHERS) {
    if (domain && matcher.domains.includes(domain)) return matcher.id;
    if (code && matcher.codes.some(prefix => code.startsWith(prefix))) return matcher.id;
    if (haystack && matcher.patterns.some(pattern => pattern.test(haystack))) return matcher.id;
  }

  return OTHER_CATEGORY_ID;
};
