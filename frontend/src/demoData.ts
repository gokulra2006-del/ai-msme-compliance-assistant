// frontend/src/demoData.ts
// Centralized mock data for hackathon demo — used as fallback when backend APIs are unavailable.

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86400000).toISOString();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const DEMO_DASHBOARD = {
  hasProfile: true,
  applies: 12,
  doesNotApply: 5,
  insufficientData: 3,
  riskBreakdown: { critical: 3, high: 4, medium: 3, low: 2 },
  applicableObligations: [
    { title: 'GST Monthly Return (GSTR-3B)', severity: 'CRITICAL', ruleCode: 'GST-3B-MONTHLY' },
    { title: 'EPF Monthly Contribution', severity: 'HIGH', ruleCode: 'EPF-MONTHLY' },
    { title: 'ESI Half-Yearly Return', severity: 'HIGH', ruleCode: 'ESI-HY' },
    { title: 'Fire Safety NOC Renewal', severity: 'CRITICAL', ruleCode: 'FIRE-NOC' },
    { title: 'Pollution Control Board Consent', severity: 'CRITICAL', ruleCode: 'PCB-CONSENT' },
    { title: 'Factory License Renewal', severity: 'HIGH', ruleCode: 'FACTORY-LIC' },
    { title: 'Professional Tax Return', severity: 'MEDIUM', ruleCode: 'PT-QUARTERLY' },
    { title: 'Shop & Establishment Renewal', severity: 'LOW', ruleCode: 'SHOP-EST' },
    { title: 'Annual GST Return (GSTR-9)', severity: 'HIGH', ruleCode: 'GST-9-ANNUAL' },
    { title: 'Labour Welfare Fund', severity: 'MEDIUM', ruleCode: 'LWF-HY' },
    { title: 'Trade License Renewal', severity: 'MEDIUM', ruleCode: 'TRADE-LIC' },
    { title: 'Udyam Registration Update', severity: 'LOW', ruleCode: 'UDYAM-UPDATE' },
  ],
  evidence: {
    summary: { total: 8, verified: 3, pending: 1, missing: 2, expiringSoon: 1, expired: 1 },
    requiredDocuments: [
      { documentType: 'GST Registration Certificate', status: 'VERIFIED', verificationStatus: 'VERIFIED', documentName: 'GST_Cert_2024.pdf' },
      { documentType: 'Udyam Registration', status: 'VERIFIED', verificationStatus: 'VERIFIED', documentName: 'Udyam_Certificate.pdf' },
      { documentType: 'Fire Safety NOC', status: 'EXPIRED', verificationStatus: 'VERIFIED', documentName: 'Fire_NOC_2022.pdf' },
      { documentType: 'EPF Registration', status: 'PENDING_REVIEW', verificationStatus: 'PENDING', documentName: 'EPF_Reg.pdf' },
      { documentType: 'ESI Registration Certificate', status: 'MISSING', verificationStatus: 'NOT_SUBMITTED' },
      { documentType: 'Pollution Control Certificate', status: 'REJECTED', verificationStatus: 'REJECTED', documentName: 'PCB_Consent_2023.pdf' },
      { documentType: 'Factory License', status: 'VERIFIED', verificationStatus: 'VERIFIED', documentName: 'Factory_License.pdf' },
      { documentType: 'PAN Card', status: 'EXPIRING_SOON', verificationStatus: 'VERIFIED', documentName: 'PAN_Card.pdf' },
    ],
  },
  calendar: {
    totalApplicable: 12,
    completed: 5,
    pending: 3,
    overdue: 2,
    dueSoon: 3,
    upcoming: [
      { title: 'GST Return GSTR-3B Filing', ruleCode: 'GST-3B-MONTHLY', dueDate: daysFromNow(-3), priority: 'CRITICAL', status: 'OVERDUE', frequency: 'MONTHLY', _id: 'demo-1' },
      { title: 'EPF Monthly Contribution', ruleCode: 'EPF-MONTHLY', dueDate: daysFromNow(5), priority: 'HIGH', status: 'PENDING', frequency: 'MONTHLY', _id: 'demo-2' },
      { title: 'Professional Tax Payment', ruleCode: 'PT-QUARTERLY', dueDate: daysFromNow(12), priority: 'MEDIUM', status: 'PENDING', frequency: 'QUARTERLY', _id: 'demo-3' },
      { title: 'Fire NOC Renewal Application', ruleCode: 'FIRE-NOC', dueDate: daysFromNow(-10), priority: 'CRITICAL', status: 'OVERDUE', frequency: 'ANNUAL', _id: 'demo-4' },
    ],
  },
  alerts: {
    overdue: 2,
    dueToday: 1,
    dueSoon: 3,
    escalations: 1,
    expiredEvidence: 1,
    pendingReview: 1,
    rejected: 1,
  },
  history: [
    { score: 68, riskLevel: 'HIGH', calculatedAt: daysAgo(30) },
    { score: 55, riskLevel: 'HIGH', calculatedAt: daysAgo(21) },
    { score: 48, riskLevel: 'MODERATE', calculatedAt: daysAgo(14) },
    { score: 44, riskLevel: 'MODERATE', calculatedAt: daysAgo(7) },
    { score: 42, riskLevel: 'MODERATE', calculatedAt: daysAgo(0) },
  ],
  activity: [
    { action: 'EVIDENCE_UPLOADED', createdAt: daysAgo(0), details: { documentType: 'GST Certificate' } },
    { action: 'RISK_SCORE_CALCULATED', createdAt: daysAgo(1), details: { score: 42 } },
    { action: 'OBLIGATION_REVIEWED', createdAt: daysAgo(2), details: { ruleCode: 'EPF-MONTHLY' } },
    { action: 'PROFILE_UPDATED', createdAt: daysAgo(3), details: { field: 'employeeCount' } },
  ],
};

export const DEMO_RISK = {
  score: 42,
  riskLevel: 'MODERATE',
  calculatedAt: new Date().toISOString(),
  riskDrivers: [
    'GST Return (GSTR-3B) is overdue by 3 days \u2014 penalty accrual has started.',
    'Fire Safety NOC expired 10 days ago \u2014 factory operations at legal risk.',
    'EPF monthly contribution payment delayed \u2014 employee welfare non-compliance.',
    'Pollution Control Board consent order was rejected \u2014 resubmission required.',
  ],
  recommendedActions: [
    'File GSTR-3B immediately via the GST Portal to stop further late fees.',
    'Apply for Fire NOC renewal at the Tamil Nadu Fire & Rescue Department.',
    'Clear pending EPF dues through the EPFO Unified Portal before the 15th.',
    'Resubmit Pollution Control Board consent application with corrected documents.',
  ],
};

// ─── Evidence Vault ──────────────────────────────────────────────────────────

export const DEMO_EVIDENCE_DASHBOARD = {
  summary: { total: 8, verified: 3, pending: 1, missing: 2, expiringSoon: 1, expired: 1 },
  requiredDocuments: [
    {
      _id: 'ev-1', documentType: 'GST Registration Certificate', status: 'VERIFIED',
      verificationStatus: 'VERIFIED', documentName: 'GST_Cert_2024.pdf',
      uploadedAt: daysAgo(45), expiresAt: daysFromNow(320),
      obligationCode: 'GST-3B-MONTHLY', notes: 'Verified by compliance officer.',
    },
    {
      _id: 'ev-2', documentType: 'Udyam Registration Certificate', status: 'VERIFIED',
      verificationStatus: 'VERIFIED', documentName: 'Udyam_Certificate.pdf',
      uploadedAt: daysAgo(90), expiresAt: null,
      obligationCode: 'UDYAM-UPDATE', notes: 'Lifetime validity.',
    },
    {
      _id: 'ev-3', documentType: 'Fire Safety NOC', status: 'EXPIRED',
      verificationStatus: 'VERIFIED', documentName: 'Fire_NOC_2022.pdf',
      uploadedAt: daysAgo(400), expiresAt: daysAgo(10),
      obligationCode: 'FIRE-NOC', notes: 'Expired \u2014 renewal required.',
    },
    {
      _id: 'ev-4', documentType: 'EPF Registration Certificate', status: 'PENDING_REVIEW',
      verificationStatus: 'PENDING', documentName: 'EPF_Reg.pdf',
      uploadedAt: daysAgo(5), expiresAt: null,
      obligationCode: 'EPF-MONTHLY', notes: 'Awaiting officer review.',
    },
    {
      _id: 'ev-5', documentType: 'ESI Registration Certificate', status: 'MISSING',
      verificationStatus: 'NOT_SUBMITTED', documentName: null,
      uploadedAt: null, expiresAt: null,
      obligationCode: 'ESI-HY', notes: 'Required for ESI compliance.',
    },
    {
      _id: 'ev-6', documentType: 'Pollution Control Consent', status: 'REJECTED',
      verificationStatus: 'REJECTED', documentName: 'PCB_Consent_2023.pdf',
      uploadedAt: daysAgo(20), expiresAt: null,
      obligationCode: 'PCB-CONSENT', notes: 'Rejected \u2014 incomplete application form.',
    },
    {
      _id: 'ev-7', documentType: 'Factory License', status: 'VERIFIED',
      verificationStatus: 'VERIFIED', documentName: 'Factory_License.pdf',
      uploadedAt: daysAgo(180), expiresAt: daysFromNow(185),
      obligationCode: 'FACTORY-LIC', notes: 'Valid until next renewal.',
    },
    {
      _id: 'ev-8', documentType: 'Professional Tax Receipt', status: 'EXPIRING_SOON',
      verificationStatus: 'VERIFIED', documentName: 'PT_Receipt_Q2.pdf',
      uploadedAt: daysAgo(80), expiresAt: daysFromNow(10),
      obligationCode: 'PT-QUARTERLY', notes: 'Expires in 10 days.',
    },
  ],
};

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export const DEMO_AUDIT_LOGS = [
  { _id: 'al-1', action: 'LOGIN', user: { name: 'Gokul R', email: 'gokulra2006@gmail.com', role: 'OWNER' }, createdAt: daysAgo(0), ip: '103.21.244.15', details: { method: 'EMAIL_PASSWORD' } },
  { _id: 'al-2', action: 'EVIDENCE_UPLOADED', user: { name: 'Gokul R', email: 'gokulra2006@gmail.com', role: 'OWNER' }, createdAt: daysAgo(0), ip: '103.21.244.15', details: { documentType: 'GST Registration Certificate', fileName: 'GST_Cert_2024.pdf' } },
  { _id: 'al-3', action: 'RISK_SCORE_CALCULATED', user: { name: 'System', email: 'system@surakshasetu.ai', role: 'SYSTEM' }, createdAt: daysAgo(1), ip: '127.0.0.1', details: { score: 42, riskLevel: 'MODERATE' } },
  { _id: 'al-4', action: 'OBLIGATION_REVIEWED', user: { name: 'Gokul R', email: 'gokulra2006@gmail.com', role: 'OWNER' }, createdAt: daysAgo(2), ip: '103.21.244.15', details: { ruleCode: 'EPF-MONTHLY', result: 'APPLIES' } },
  { _id: 'al-5', action: 'PROFILE_UPDATED', user: { name: 'Gokul R', email: 'gokulra2006@gmail.com', role: 'OWNER' }, createdAt: daysAgo(3), ip: '103.21.244.15', details: { field: 'employeeCount', oldValue: '75', newValue: '85' } },
  { _id: 'al-6', action: 'EVIDENCE_VERIFIED', user: { name: 'Dishal C', email: 'dishalcbi@gmail.com', role: 'COMPLIANCE_OFFICER' }, createdAt: daysAgo(4), ip: '49.37.12.88', details: { documentType: 'Udyam Registration', status: 'VERIFIED' } },
  { _id: 'al-7', action: 'DOCUMENT_GENERATED', user: { name: 'Gokul R', email: 'gokulra2006@gmail.com', role: 'OWNER' }, createdAt: daysAgo(5), ip: '103.21.244.15', details: { templateKey: 'GST_RETURN_DRAFT', version: 1 } },
  { _id: 'al-8', action: 'EVIDENCE_REJECTED', user: { name: 'Dishal C', email: 'dishalcbi@gmail.com', role: 'COMPLIANCE_OFFICER' }, createdAt: daysAgo(6), ip: '49.37.12.88', details: { documentType: 'Pollution Control Consent', reason: 'Incomplete application form' } },
  { _id: 'al-9', action: 'LOGIN', user: { name: 'Dhanish K', email: 'dhanishkanth1122@gmail.com', role: 'ACCOUNTANT' }, createdAt: daysAgo(7), ip: '182.69.33.41', details: { method: 'EMAIL_PASSWORD' } },
  { _id: 'al-10', action: 'FIREWALL_BLOCKED', user: { name: 'System', email: 'system@surakshasetu.ai', role: 'SYSTEM' }, createdAt: daysAgo(1), ip: '185.220.101.45', details: { attackType: 'Brute Force', endpoint: '/api/auth/login', action: 'IP Blocked' } },
];

// ─── Document Preparation Dashboard ──────────────────────────────────────────

export const DEMO_DOC_DASHBOARD = {
  actions: [
    { _id: 'doc-1', title: 'GST Return Filing Template', ruleCode: 'GST-3B-MONTHLY', status: 'DRAFT' },
    { _id: 'doc-2', title: 'Fire NOC Renewal Application', ruleCode: 'FIRE-NOC', status: 'NEEDED' },
    { _id: 'doc-3', title: 'EPF Monthly Contribution Statement', ruleCode: 'EPF-MONTHLY', status: 'APPROVED' },
    { _id: 'doc-4', title: 'Pollution Control Board Re-Application', ruleCode: 'PCB-CONSENT', status: 'DRAFT' },
    { _id: 'doc-5', title: 'Factory License Renewal Form', ruleCode: 'FACTORY-LIC', status: 'NEEDED' },
  ],
};
