const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const Evidence = require('../models/Evidence');

// These are intentionally non-official internal preparation templates. The
// project does not contain verified government form files, so it must not
// manufacture or present an official form as available.
const DRAFT_TEMPLATES = [
  {
    key: 'INTERNAL_COMPLIANCE_DECLARATION',
    label: 'Internal compliance declaration',
    description: 'A structured internal review draft. It is not an official declaration or filing.',
    requiredFields: ['ownerName', 'entityType', 'industry', 'state']
  },
  {
    key: 'CORRECTIVE_ACTION_REPORT',
    label: 'Corrective action report',
    description: 'A draft for documenting internal corrective actions before human review.',
    requiredFields: ['ownerName', 'industry', 'state']
  },
  {
    key: 'INSPECTION_RESPONSE_DRAFT',
    label: 'Inspection response draft',
    description: 'A non-official response outline that requires review before any submission.',
    requiredFields: ['ownerName', 'entityType', 'state']
  },
  {
    key: 'DOCUMENT_SUBMISSION_COVER_LETTER',
    label: 'Document submission cover letter',
    description: 'A generic cover-letter draft for human review; it is not an acknowledgement or submission.',
    requiredFields: ['ownerName', 'entityType', 'state']
  }
];

const profileFields = [
  { key: 'ownerName', label: 'Responsible person' },
  { key: 'entityType', label: 'Legal entity type' },
  { key: 'industry', label: 'Industry' },
  { key: 'subIndustry', label: 'Sub-industry' },
  { key: 'state', label: 'State' },
  { key: 'district', label: 'District' },
  { key: 'city', label: 'City' },
  { key: 'totalWorkers', label: 'Employee count' },
  { key: 'contractWorkers', label: 'Contract workers' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'udyamRegistration', label: 'Udyam registration' },
  { key: 'factoryStatus', label: 'Factory status' }
];

function presentValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function getProfileSnapshot(business, user) {
  const values = { ...business.toObject(), ownerName: user?.name };
  return profileFields.map(field => ({
    ...field,
    value: presentValue(values[field.key]) ? String(values[field.key]) : null,
    source: 'USER_ENTERED'
  }));
}

function normalise(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findRule(ruleCode) {
  return ComplianceRule.findOne({
    ruleCode,
    status: { $nin: ['INACTIVE', 'EXPIRED', 'ARCHIVED'] }
  }).lean();
}

async function getPreparationSnapshot({ business, user, obligationCode }) {
  const rule = await findRule(obligationCode);
  if (!rule) return { error: 'Applicable obligation not found.' };

  const [action, evidence] = await Promise.all([
    ComplianceAction.findOne({ business: business._id, ruleCode: obligationCode }).lean(),
    Evidence.find({ business: business._id, verificationStatus: 'VERIFIED', isLatestVersion: true }).lean()
  ]);

  const profile = getProfileSnapshot(business, user);
  const profileByKey = Object.fromEntries(profile.map(item => [item.key, item]));
  const requiredEvidence = rule.requiredEvidence || [];
  const evidenceChecklist = requiredEvidence.map(documentType => {
    const match = evidence.find(item => normalise(item.documentType) === normalise(documentType));
    return {
      documentType,
      status: match ? 'VERIFIED' : 'MISSING',
      evidenceId: match?._id || null,
      documentName: match?.documentName || null
    };
  });

  const templates = DRAFT_TEMPLATES.map(template => {
    const missingInformation = template.requiredFields
      .filter(key => !profileByKey[key]?.value)
      .map(key => ({ key, label: profileByKey[key]?.label || key }));
    return {
      ...template,
      status: missingInformation.length ? 'MISSING_INFORMATION' : 'READY_TO_GENERATE',
      missingInformation
    };
  });

  return {
    rule,
    action,
    profile,
    evidenceChecklist,
    templates,
    officialTemplateAvailable: false,
    officialTemplateNotice: 'Official form/template not available in the verified source database.'
  };
}

function templateByKey(key) {
  return DRAFT_TEMPLATES.find(template => template.key === key);
}

function buildDraftContent({ template, snapshot }) {
  const profileByKey = Object.fromEntries(snapshot.profile.map(item => [item.key, item]));
  const line = key => `${profileByKey[key].label}: ${profileByKey[key].value}`;
  const verifiedEvidence = snapshot.evidenceChecklist.filter(item => item.status === 'VERIFIED');
  const rule = snapshot.rule;

  const shared = [
    'DRAFT — REQUIRES HUMAN REVIEW',
    '',
    `${template.label.toUpperCase()}`,
    '',
    'This document was automatically prepared from available SurakshaSetu information.',
    'It is not a government form, legal advice, an official filing, or proof of submission.',
    '',
    `Related obligation: ${rule.title}`,
    `Obligation code: ${rule.ruleCode}`,
    `Regulator: ${rule.regulator || 'MISSING INFORMATION'}`,
    `Jurisdiction: ${rule.jurisdictionLevel || 'MISSING INFORMATION'}`,
    '',
    'AVAILABLE BUSINESS INFORMATION',
    ...template.requiredFields.map(line),
    '',
    'VERIFIED SUPPORTING EVIDENCE',
    ...(verifiedEvidence.length
      ? verifiedEvidence.map(item => `- ${item.documentType}: ${item.documentName}`)
      : ['- No verified supporting evidence is currently linked.']),
    '',
    'PREPARATION NOTES',
  ];

  if (template.key === 'CORRECTIVE_ACTION_REPORT') {
    shared.push(
      '1. Describe the observed compliance gap using verified records.',
      '2. Record the proposed corrective action, owner, and due date after human review.',
      '3. Attach the evidence used to verify completion.'
    );
  } else if (template.key === 'INSPECTION_RESPONSE_DRAFT') {
    shared.push(
      '1. Insert the official inspection reference number after it has been manually verified.',
      '2. Summarise the response only from verified documents and official correspondence.',
      '3. Obtain authorised sign-off before any external use.'
    );
  } else if (template.key === 'DOCUMENT_SUBMISSION_COVER_LETTER') {
    shared.push(
      '1. Add the receiving authority and official reference only after manual verification.',
      '2. List only documents that are actually enclosed.',
      '3. Obtain authorised sign-off before any external use.'
    );
  } else {
    shared.push(
      '1. Confirm every factual statement against the source record.',
      '2. Complete any official form directly from its verified source, if one is required.',
      '3. Obtain authorised internal review before using this draft.'
    );
  }

  shared.push('', 'DRAFT — REQUIRES HUMAN REVIEW');
  return shared.join('\n');
}

module.exports = {
  DRAFT_TEMPLATES,
  getPreparationSnapshot,
  templateByKey,
  buildDraftContent
};
