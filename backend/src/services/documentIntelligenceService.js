const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Evidence = require('../models/Evidence');
const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const { UPLOAD_DIR } = require('../middleware/upload');
const { logAudit } = require('../utils/auditLogger');
const { normaliseDocType, getExpiryStatus } = require('../utils/evidenceStatus');

// Document categories are descriptive labels for what the uploaded file LOOKS
// like. They are not legal classifications and they are never used to assert
// that a document satisfies a regulatory requirement. No new document type is
// invented here beyond the descriptive buckets the vault already used.
const KEYWORDS = {
  LICENCE: ['licence', 'license', 'factory licence', 'factory license', 'trade licence', 'trade license'],
  PERMIT: ['permit', 'permission', 'noc', 'no objection certificate'],
  CERTIFICATE: ['certificate', 'certified'],
  REGISTRATION: ['registration', 'udyam', 'registered'],
  FILING_ACKNOWLEDGEMENT: ['acknowledgement', 'acknowledgment', 'arn', 'filed on', 'submission receipt', 'challan'],
  NOTICE: ['notice', 'show cause', 'memorandum'],
  RETURN: ['return', 'monthly return', 'annual return'],
  DECLARATION: ['declaration', 'declared', 'undertaking'],
  INSPECTION_REPORT: ['inspection report', 'inspection', 'inspection memo'],
  ENVIRONMENTAL_DOCUMENT: ['environmental', 'pollution', 'consent to operate', 'consent to establish'],
  LABOUR_DOCUMENT: ['labour', 'labor', 'employee', 'wage', 'epf', 'esi'],
  TAX_DOCUMENT: ['gst', 'tax', 'gstin'],
  SUPPORTING_BUSINESS_DOCUMENT: ['invoice', 'agreement', 'lease', 'rent', 'electricity bill', 'bank statement', 'pan']
};

// Human-readable text for every flag the service can raise. The wording is
// deliberately "POTENTIAL ISSUE" phrasing — the system never declares a document
// legally invalid.
const POTENTIAL_ISSUE_LABELS = {
  DOCUMENT_TEXT_REQUIRES_MANUAL_VERIFICATION: 'Document text could not be read automatically. Manual verification required.',
  OCR_NOT_AVAILABLE: 'This is an image file and OCR is not available in this deployment. The contents were not read.',
  CLASSIFICATION_REQUIRES_REVIEW: 'The document category could not be determined confidently. Please confirm it.',
  NO_RELIABLE_METADATA_EXTRACTED: 'No reliable details could be extracted from this document.',
  DOCUMENT_APPEARS_EXPIRED: 'The date read from this document appears to be in the past.',
  FILE_APPEARS_EMPTY: 'The uploaded file appears to be empty.',
  FILE_MAY_BE_INCOMPLETE: 'The file structure looks incomplete or truncated. It may not have uploaded fully.',
  FILE_MAY_BE_CORRUPTED: 'The file could not be parsed and may be corrupted.',
  SCAN_APPEARS_UNREADABLE: 'The document appears to be a scan with no readable text layer.',
  SINGLE_PAGE_ONLY: 'Only one page was detected. Confirm no pages are missing.',
  SIGNATURE_NOT_DETECTED: 'No signature or seal was detected in the readable text. This may be normal for this document.',
  EXPIRY_DATE_NOT_DETECTED: 'No expiry date was detected. If this document expires, add the date manually.',
  POSSIBLE_DUPLICATE: 'This document looks like a duplicate of another record. Please review.',
  MISMATCHED_DOCUMENT_TYPE: 'The detected category does not match the category selected at upload. Please review.'
};

const MISSING_INFORMATION_LABELS = {
  DOCUMENT_NUMBER_NOT_DETECTED: 'Document/reference number was not found in the document text.',
  ISSUING_AUTHORITY_NOT_DETECTED: 'Issuing authority was not found in the document text.',
  ISSUE_DATE_NOT_DETECTED: 'Issue date was not found in the document text.',
  EXPIRY_DATE_NOT_DETECTED: 'Expiry/validity date was not found in the document text.'
};

// OCR capability is detected, never assumed. If no OCR engine is installed the
// system reports it instead of pretending an image was read.
function detectOcrCapability() {
  for (const moduleName of ['tesseract.js', 'node-tesseract-ocr', 'tesseract.js-node']) {
    try {
      require.resolve(moduleName);
      return { available: true, engine: moduleName };
    } catch (_) {
      // not installed
    }
  }
  return { available: false, engine: null };
}

const OCR_CAPABILITY = detectOcrCapability();
const OCR_UNAVAILABLE_NOTICE = 'OCR NOT CURRENTLY AVAILABLE — this deployment has no OCR engine installed, so the contents of image files are not read. Please verify this document manually.';

function cleanText(value) {
  return String(value || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function literalStrings(raw) {
  const values = [];
  const matches = raw.matchAll(/\((?:\\.|[^\\)]){4,}\)/g);
  for (const match of matches) {
    const text = cleanText(match[0].slice(1, -1));
    if (text.length >= 4 && /[a-zA-Z0-9]/.test(text)) values.push(text);
  }
  return values;
}

// A conservative extraction for text-based PDFs using only the installed
// stack. It does not claim OCR capability and returns no values when it cannot
// reliably recover readable text.
function extractPdfText(buffer) {
  const raw = buffer.toString('latin1');
  const chunks = literalStrings(raw);
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  for (const match of raw.matchAll(streamPattern)) {
    const before = raw.slice(Math.max(0, match.index - 250), match.index);
    if (!/FlateDecode/.test(before)) continue;
    try {
      const inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      chunks.push(...literalStrings(inflated));
    } catch (_) {
      // A malformed or differently encoded stream is intentionally ignored.
    }
  }
  const text = cleanText(chunks.join('\n'));
  return text.length >= 24 ? text.slice(0, 12000) : '';
}

// Structural facts about the PDF container. These are observations about the
// file, not conclusions about the document's legal validity.
function inspectPdfStructure(buffer) {
  const raw = buffer.toString('latin1');
  const header = raw.slice(0, 1024);
  const tail = raw.slice(-2048);
  const pageMatches = raw.match(/\/Type\s*\/Page(?![sA-Za-z])/g);
  let pageCount = pageMatches ? pageMatches.length : null;
  if (!pageCount) {
    const countMatch = raw.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
    if (countMatch) pageCount = Number(countMatch[1]);
  }
  return {
    hasHeader: header.startsWith('%PDF-'),
    hasTrailer: /%%EOF/.test(tail) || /%%EOF/.test(raw),
    hasObjects: /\bendobj\b/.test(raw),
    hasEmbeddedSignature: /\/Type\s*\/Sig\b|\/SubFilter\s*\/(?:adbe|ETSI)/i.test(raw),
    pageCount: pageCount || null
  };
}

/**
 * Reads whatever can honestly be read from the stored file.
 * Never fabricates content and never claims an image was read.
 */
function extractText(evidence) {
  const filePath = path.join(UPLOAD_DIR, evidence.filePath);
  if (!fs.existsSync(filePath)) throw new Error('Uploaded file is not available for analysis.');

  const stats = fs.statSync(filePath);
  const base = {
    text: '',
    notice: '',
    status: 'NOT_ATTEMPTED',
    pageCount: null,
    structure: null,
    ocrStatus: 'NOT_APPLICABLE',
    fileEmpty: stats.size === 0
  };

  if (stats.size === 0) {
    return { ...base, status: 'FAILED', notice: 'The uploaded file is empty (0 bytes). Nothing could be read from it.' };
  }

  if (evidence.mimeType === 'application/pdf') {
    const buffer = fs.readFileSync(filePath);
    const structure = inspectPdfStructure(buffer);
    if (!structure.hasHeader) {
      return {
        ...base,
        status: 'FAILED',
        structure,
        notice: 'This file does not have a valid PDF structure and could not be parsed. Please verify manually.'
      };
    }
    const text = extractPdfText(buffer);
    return {
      ...base,
      text,
      structure,
      pageCount: structure.pageCount,
      status: text ? 'EXTRACTED' : 'NO_TEXT_LAYER',
      notice: text
        ? 'Text was extracted from this PDF. Review extracted values before relying on them.'
        : 'This PDF has no readable text layer (it is most likely a scan). Its contents were not read. Please verify manually.'
    };
  }

  // Image upload. OCR is only ever reported as available if an engine exists.
  return {
    ...base,
    status: 'OCR_NOT_AVAILABLE',
    ocrStatus: OCR_CAPABILITY.available ? 'NOT_APPLICABLE' : 'NOT_AVAILABLE',
    notice: OCR_UNAVAILABLE_NOTICE
  };
}

function classifyDocument(text, originalFileName, userLabel) {
  const haystack = `${text}\n${originalFileName || ''}\n${userLabel || ''}`.toLowerCase();
  const ranked = Object.entries(KEYWORDS).map(([documentType, keywords]) => {
    const hits = keywords.reduce((count, keyword) => count + (haystack.includes(keyword) ? 1 : 0), 0);
    return { documentType, hits };
  }).sort((a, b) => b.hits - a.hits);
  const best = ranked[0];
  if (!best || best.hits === 0) return { documentType: 'UNKNOWN', confidence: 0, source: 'NONE' };

  const textHasSignal = text && KEYWORDS[best.documentType].some(keyword => text.toLowerCase().includes(keyword));
  return {
    documentType: best.documentType,
    // Confidence is a percentage (0-100) of how strongly the keywords matched.
    // It is a text-matching score, not a legal certainty score.
    confidence: Math.min(96, textHasSignal ? 65 + (best.hits - 1) * 12 : 50 + (best.hits - 1) * 10),
    source: textHasSignal ? 'TEXT_EXTRACTION' : (originalFileName ? 'FILENAME' : 'USER_LABEL')
  };
}

function parseDate(value) {
  const clean = String(value || '').trim();
  let match = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  match = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function field(fieldName, value, confidence, originalText, source = 'DOCUMENT_TEXT') {
  return {
    field: fieldName,
    value: String(value).trim(),
    confidence,
    source,
    originalText: String(originalText || value).trim()
  };
}

function extractMetadata(text, originalFileName) {
  const fields = [];
  const addUnique = item => {
    if (item.value && !fields.some(existing => existing.field === item.field && existing.value === item.value)) fields.push(item);
  };

  if (text) {
    const gstin = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/);
    if (gstin) addUnique(field('gstin', gstin[0], 98, gstin[0]));

    const udyam = text.match(/\bUDYAM-[A-Z]{2}-\d{2}-\d{7}\b/i);
    if (udyam) addUnique(field('udyamRegistration', udyam[0].toUpperCase(), 98, udyam[0]));

    const numberPattern = /(?:licen[cs]e|registration|certificate|permit|acknowledgement|application|reference)\s*(?:number|no\.?|id|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,})/ig;
    for (const match of text.matchAll(numberPattern)) addUnique(field('documentNumber', match[1], 82, match[0]));

    const authority = text.match(/(?:issued\s+by|issuing\s+authority|office\s+of\s+the)\s*[:\-]?\s*([^\n]{3,90})/i);
    if (authority) addUnique(field('issuingAuthority', cleanText(authority[1]), 76, authority[0]));

    const datePatterns = [
      { name: 'issueDate', pattern: /(?:issue\s+date|issued\s+on|date\s+of\s+issue)\s*[:\-]?\s*(\d{1,2}[\-/.]\d{1,2}[\-/.]\d{4}|\d{4}[\-/.]\d{1,2}[\-/.]\d{1,2})/ig },
      { name: 'expiryDate', pattern: /(?:expiry\s+date|expires?\s+on|valid\s+(?:till|until|up\s+to)|date\s+of\s+expiry)\s*[:\-]?\s*(\d{1,2}[\-/.]\d{1,2}[\-/.]\d{4}|\d{4}[\-/.]\d{1,2}[\-/.]\d{1,2})/ig },
      { name: 'renewalDate', pattern: /(?:renewal\s+date|renew\s+by)\s*[:\-]?\s*(\d{1,2}[\-/.]\d{1,2}[\-/.]\d{4}|\d{4}[\-/.]\d{1,2}[\-/.]\d{1,2})/ig }
    ];
    for (const datePattern of datePatterns) {
      for (const match of text.matchAll(datePattern.pattern)) {
        const parsed = parseDate(match[1]);
        if (parsed) addUnique(field(datePattern.name, parsed.toISOString().slice(0, 10), 88, match[0]));
      }
    }
  }

  // Filename-derived title is clearly marked as such and carries low confidence
  // so it is never mistaken for a value read from the document body.
  const filename = path.basename(originalFileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (filename) addUnique(field('documentTitle', filename, 45, filename, 'FILENAME'));
  return fields;
}

/**
 * Completeness / readability observations. Every entry is a POTENTIAL issue for
 * a human to check — none of them is a legal determination.
 */
function detectCompletenessIssues({ extraction, classification, extractedFields, evidence }) {
  const issues = [];
  const missingInformation = [];

  if (extraction.fileEmpty) issues.push('FILE_APPEARS_EMPTY');
  if (extraction.status === 'FAILED' && !extraction.fileEmpty) issues.push('FILE_MAY_BE_CORRUPTED');
  if (extraction.status === 'OCR_NOT_AVAILABLE') issues.push('OCR_NOT_AVAILABLE');
  if (extraction.status === 'NO_TEXT_LAYER') issues.push('SCAN_APPEARS_UNREADABLE');
  if (!extraction.text && extraction.status !== 'OCR_NOT_AVAILABLE') {
    issues.push('DOCUMENT_TEXT_REQUIRES_MANUAL_VERIFICATION');
  }

  const structure = extraction.structure;
  if (structure) {
    if (structure.hasHeader && (!structure.hasTrailer || !structure.hasObjects)) issues.push('FILE_MAY_BE_INCOMPLETE');
    if (structure.pageCount === 1) issues.push('SINGLE_PAGE_ONLY');
    // Signature detection is only meaningful when text was actually readable.
    if (extraction.text && !structure.hasEmbeddedSignature && !/\b(signature|signed|seal|digitally signed|authorised signatory)\b/i.test(extraction.text)) {
      issues.push('SIGNATURE_NOT_DETECTED');
    }
  }

  if (classification.documentType === 'UNKNOWN' || classification.confidence < 65) {
    issues.push('CLASSIFICATION_REQUIRES_REVIEW');
  }
  if (!extractedFields.some(item => item.source === 'DOCUMENT_TEXT')) {
    issues.push('NO_RELIABLE_METADATA_EXTRACTED');
  }

  // Missing-information entries describe what could not be READ from the file.
  // They are not statements about what the law requires.
  if (extraction.text) {
    if (!extractedFields.some(item => item.field === 'documentNumber')) missingInformation.push('DOCUMENT_NUMBER_NOT_DETECTED');
    if (!extractedFields.some(item => item.field === 'issuingAuthority')) missingInformation.push('ISSUING_AUTHORITY_NOT_DETECTED');
    if (!extractedFields.some(item => item.field === 'issueDate') && !evidence.issueDate) missingInformation.push('ISSUE_DATE_NOT_DETECTED');
    if (!extractedFields.some(item => item.field === 'expiryDate') && !evidence.expiryDate) missingInformation.push('EXPIRY_DATE_NOT_DETECTED');
  }

  const expiryField = extractedFields.find(item => item.field === 'expiryDate');
  const effectiveExpiry = evidence.expiryDate || (expiryField ? expiryField.value : null);
  if (effectiveExpiry && getExpiryStatus(effectiveExpiry) === 'EXPIRED') issues.push('DOCUMENT_APPEARS_EXPIRED');
  if (!effectiveExpiry) issues.push('EXPIRY_DATE_NOT_DETECTED');

  // A category mismatch between the user's label and the detected category is
  // reported for review; the user's label is never overwritten.
  if (
    classification.documentType !== 'UNKNOWN' &&
    classification.confidence >= 65 &&
    evidence.documentType &&
    !normaliseDocType(evidence.documentType).includes(normaliseDocType(classification.documentType)) &&
    !normaliseDocType(classification.documentType).includes(normaliseDocType(evidence.documentType))
  ) {
    issues.push('MISMATCHED_DOCUMENT_TYPE');
  }

  return { issues: [...new Set(issues)], missingInformation: [...new Set(missingInformation)] };
}

/**
 * A plain-language summary built ONLY from what was read out of this document
 * plus the record's own stored metadata. It contains no regulatory statements
 * and never asserts validity.
 */
function buildDocumentSummary({ evidence, extraction, classification, extractedFields }) {
  const valueOf = name => {
    const found = extractedFields.find(item => item.field === name);
    return found ? found.value : null;
  };

  if (extraction.status === 'OCR_NOT_AVAILABLE') {
    return `"${evidence.documentName}" is an image file. OCR NOT CURRENTLY AVAILABLE, so its contents were not read. No details can be summarised from the document itself.`;
  }
  if (!extraction.text) {
    return `"${evidence.documentName}" could not be read automatically, so no summary can be produced from its contents. It must be reviewed manually.`;
  }

  const parts = [];
  const category = classification.documentType && classification.documentType !== 'UNKNOWN'
    ? classification.documentType.replace(/_/g, ' ').toLowerCase()
    : 'document of an undetermined category';
  parts.push(`The uploaded file appears to be a ${category}.`);

  const number = valueOf('documentNumber');
  if (number) parts.push(`It shows the reference number ${number}.`);

  const authority = valueOf('issuingAuthority');
  if (authority) parts.push(`It states it was issued by ${authority}.`);

  const issue = valueOf('issueDate');
  if (issue) parts.push(`An issue date of ${issue} was read from the text.`);

  const expiry = valueOf('expiryDate') || (evidence.expiryDate ? new Date(evidence.expiryDate).toISOString().slice(0, 10) : null);
  if (expiry) {
    const status = getExpiryStatus(expiry);
    if (status === 'EXPIRED') parts.push(`The validity date on record (${expiry}) is in the past.`);
    else if (status === 'EXPIRING_SOON') parts.push(`The validity date on record (${expiry}) is approaching.`);
    else parts.push(`A validity date of ${expiry} is on record.`);
  } else {
    parts.push('No validity or expiry date could be read from the document.');
  }

  const identifiers = [valueOf('gstin') && `GSTIN ${valueOf('gstin')}`, valueOf('udyamRegistration') && `Udyam ${valueOf('udyamRegistration')}`].filter(Boolean);
  if (identifiers.length) parts.push(`It also references ${identifiers.join(' and ')}.`);

  if (extraction.pageCount) parts.push(`${extraction.pageCount} page(s) were detected.`);

  parts.push('These details were read from the file and have not been verified against any authority.');
  return parts.join(' ');
}

function matchScore(terms, text) {
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

async function findObligationSuggestion(evidence, classification) {
  const rules = await ComplianceRule.find({ status: { $nin: ['INACTIVE', 'EXPIRED', 'ARCHIVED'] } }).lean();
  const label = `${evidence.documentType || ''} ${classification.documentType || ''}`.toLowerCase();
  const candidates = rules.map(rule => {
    const terms = [rule.title, ...(rule.requiredEvidence || [])]
      .flatMap(value => String(value || '').toLowerCase().split(/\s+/))
      .filter(term => term.length > 3);
    const score = matchScore(terms, label);
    return { rule, score };
  }).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score);
  if (!candidates.length) return { status: 'NONE', confidence: 0 };
  const best = candidates[0];
  return {
    // A suggestion only. Linking always requires a human action.
    status: 'POSSIBLE_MATCH',
    obligationCode: best.rule.ruleCode,
    obligationTitle: best.rule.title,
    confidence: Math.min(94, 58 + best.score * 9 + (classification.confidence >= 70 ? 10 : 0))
  };
}

/**
 * Flags possible duplicates for human review. It never deletes, merges or
 * modifies the other record (Prompt 16 §33).
 */
async function detectDuplicateFlags(evidence) {
  const flags = [];
  const seen = new Set();
  const push = (reason, related) => {
    const key = `${reason}:${related}`;
    if (seen.has(key)) return;
    seen.add(key);
    flags.push({ reason, relatedEvidence: related, detectedAt: new Date(), acknowledged: false });
  };

  const baseFilter = {
    business: evidence.business,
    _id: { $ne: evidence._id },
    isLatestVersion: true,
    archived: { $ne: true }
  };

  if (evidence.fileHash) {
    const sameFile = await Evidence.find({ ...baseFilter, fileHash: evidence.fileHash }).select('_id').lean();
    sameFile.forEach(item => push('IDENTICAL_FILE', item._id));
  }

  if (evidence.documentNumber) {
    const sameNumber = await Evidence.find({ ...baseFilter, documentNumber: evidence.documentNumber }).select('_id').lean();
    sameNumber.forEach(item => push('SAME_DOCUMENT_NUMBER', item._id));
  }

  if (evidence.issueDate && evidence.documentType) {
    const dayStart = new Date(evidence.issueDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const sameDay = await Evidence.find({ ...baseFilter, issueDate: { $gte: dayStart, $lt: dayEnd } })
      .select('_id documentType').lean();
    sameDay
      .filter(item => normaliseDocType(item.documentType) === normaliseDocType(evidence.documentType))
      .forEach(item => push('SAME_TYPE_AND_ISSUE_DATE', item._id));
  }

  return flags;
}

async function syncReliableExpiryAction(evidence) {
  if (!evidence.expiryDate) return;
  await ComplianceAction.findOneAndUpdate(
    { business: evidence.business, ruleCode: evidence.obligationCode, source: 'EVIDENCE_EXPIRY' },
    {
      $set: {
        title: `Renew: ${evidence.documentName}`,
        description: `Evidence document "${evidence.documentName}" has a manually verifiable expiry date.`,
        category: 'Evidence Renewal',
        dueDate: evidence.expiryDate,
        priority: 'HIGH',
        applicability: 'APPLIES',
        evidenceRequired: [evidence.documentType]
      },
      $addToSet: { evidenceDocumentIds: evidence._id }
    },
    { upsert: true }
  );
}

class DocumentIntelligenceService {
  /** Reported to the API/UI so OCR status is never guessed at by the frontend. */
  getOcrCapability() {
    return {
      available: OCR_CAPABILITY.available,
      engine: OCR_CAPABILITY.engine,
      notice: OCR_CAPABILITY.available ? null : OCR_UNAVAILABLE_NOTICE
    };
  }

  getIssueLabels() {
    return { potentialIssues: POTENTIAL_ISSUE_LABELS, missingInformation: MISSING_INFORMATION_LABELS };
  }

  describeIssues(codes = []) {
    return codes.map(code => ({ code, label: POTENTIAL_ISSUE_LABELS[code] || code }));
  }

  describeMissingInformation(codes = []) {
    return codes.map(code => ({ code, label: MISSING_INFORMATION_LABELS[code] || code }));
  }

  async processDocument(evidenceId, req) {
    let evidence;
    try {
      evidence = await Evidence.findById(evidenceId);
      if (!evidence) throw new Error('Evidence not found');

      evidence.processingStatus = 'PROCESSING';
      await evidence.save();
      await logAudit({ req, action: 'EVIDENCE_ANALYSIS_STARTED', entity: 'Evidence', entityId: evidence._id, businessId: evidence.business });

      const extraction = extractText(evidence);
      const classification = classifyDocument(extraction.text, evidence.originalFileName, evidence.documentType);
      const extractedFields = extractMetadata(extraction.text, evidence.originalFileName);
      const obligationMatch = await findObligationSuggestion(evidence, classification);

      // Preserve manual corrections made by a reviewer on a previous analysis
      // run. A re-analysis must never silently discard human input.
      const previousCorrections = new Map(
        (evidence.extractedFields || [])
          .filter(item => item.correctedValue)
          .map(item => [item.field, item])
      );
      extractedFields.forEach(item => {
        const correction = previousCorrections.get(item.field);
        if (correction) {
          item.correctedValue = correction.correctedValue;
          item.correctedBy = correction.correctedBy;
          item.correctedAt = correction.correctedAt;
          item.source = 'USER_CORRECTION';
        }
      });
      // Keep corrected fields that this run no longer detects.
      previousCorrections.forEach((correction, name) => {
        if (!extractedFields.some(item => item.field === name)) {
          extractedFields.push({
            field: name,
            value: correction.value,
            confidence: correction.confidence,
            source: 'USER_CORRECTION',
            originalText: correction.originalText,
            correctedValue: correction.correctedValue,
            correctedBy: correction.correctedBy,
            correctedAt: correction.correctedAt
          });
        }
      });

      const effectiveValue = name => {
        const found = extractedFields.find(item => item.field === name);
        return found ? (found.correctedValue || found.value) : null;
      };

      evidence.classification = classification;
      evidence.extractedFields = extractedFields;
      evidence.obligationMatch = obligationMatch;
      evidence.relatedObligationSuggestion = obligationMatch.obligationCode || null;

      // Normalised identifiers, only ever taken from the document's own text.
      evidence.documentNumber = effectiveValue('documentNumber') || evidence.documentNumber || null;
      evidence.issuingAuthority = effectiveValue('issuingAuthority') || evidence.issuingAuthority || null;

      // Only a high-confidence date is promoted onto the record. Everything else
      // stays an extraction awaiting human confirmation.
      const expiryField = extractedFields.find(item => item.field === 'expiryDate');
      if (!evidence.expiryDate && expiryField && (expiryField.correctedValue || expiryField.confidence >= 80)) {
        const parsed = new Date(expiryField.correctedValue || expiryField.value);
        if (!Number.isNaN(parsed.getTime())) evidence.expiryDate = parsed;
      }
      const issueField = extractedFields.find(item => item.field === 'issueDate');
      if (!evidence.issueDate && issueField && (issueField.correctedValue || issueField.confidence >= 80)) {
        const parsed = new Date(issueField.correctedValue || issueField.value);
        if (!Number.isNaN(parsed.getTime())) evidence.issueDate = parsed;
      }

      const completeness = detectCompletenessIssues({ extraction, classification, extractedFields, evidence });
      const duplicateFlags = await detectDuplicateFlags(evidence);
      if (duplicateFlags.length) completeness.issues.push('POSSIBLE_DUPLICATE');

      evidence.extraction = {
        textAvailable: Boolean(extraction.text),
        textPreview: extraction.text ? extraction.text.slice(0, 500) : '',
        notice: extraction.notice,
        status: extraction.status,
        textLength: extraction.text ? extraction.text.length : 0,
        pageCount: extraction.pageCount,
        fullText: extraction.text || ''
      };
      evidence.ocrStatus = extraction.ocrStatus;
      evidence.potentialIssues = completeness.issues;
      evidence.missingInformation = completeness.missingInformation;
      // Existing acknowledgements survive re-analysis.
      const acknowledged = new Map((evidence.duplicateFlags || []).map(flag => [`${flag.reason}:${flag.relatedEvidence}`, flag.acknowledged]));
      evidence.duplicateFlags = duplicateFlags.map(flag => ({
        ...flag,
        acknowledged: acknowledged.get(`${flag.reason}:${flag.relatedEvidence}`) || false
      }));
      evidence.documentSummary = buildDocumentSummary({ evidence, extraction, classification, extractedFields });

      if (extraction.status === 'OCR_NOT_AVAILABLE') evidence.processingStatus = 'OCR_NOT_CONFIGURED';
      else if (extraction.status === 'FAILED') evidence.processingStatus = 'FAILED';
      else evidence.processingStatus = extraction.text ? 'PROCESSED' : 'NEEDS_REVIEW';

      await evidence.save();

      if (evidence.expiryDate) await syncReliableExpiryAction(evidence);
      await logAudit({
        req,
        action: 'EVIDENCE_ANALYZED',
        entity: 'Evidence',
        entityId: evidence._id,
        businessId: evidence.business,
        metadata: {
          classification: classification.documentType,
          classificationConfidence: classification.confidence,
          extractionStatus: extraction.status,
          ocrStatus: extraction.ocrStatus,
          pageCount: extraction.pageCount,
          extractedFieldCount: extractedFields.length,
          potentialIssues: completeness.issues,
          obligationMatch: obligationMatch.obligationCode || null
        }
      });
      if (extractedFields.length) {
        await logAudit({ req, action: 'DOCUMENT_METADATA_EXTRACTED', entity: 'Evidence', entityId: evidence._id, businessId: evidence.business, metadata: { fields: extractedFields.map(item => item.field) } });
      }
      if (obligationMatch.status === 'POSSIBLE_MATCH') {
        await logAudit({ req, action: 'EVIDENCE_OBLIGATION_MATCH_SUGGESTED', entity: 'Evidence', entityId: evidence._id, businessId: evidence.business, metadata: obligationMatch });
      }
      if (duplicateFlags.length) {
        await logAudit({
          req,
          action: 'EVIDENCE_DUPLICATE_FLAGGED',
          entity: 'Evidence',
          entityId: evidence._id,
          businessId: evidence.business,
          metadata: { flags: duplicateFlags.map(flag => ({ reason: flag.reason, relatedEvidence: String(flag.relatedEvidence) })) }
        });
      }
      return evidence;
    } catch (err) {
      console.error('Document intelligence failed:', err.message);
      if (evidence) {
        evidence.processingStatus = 'FAILED';
        evidence.extraction = {
          textAvailable: false,
          notice: 'Document analysis failed. Please verify manually.',
          status: 'FAILED',
          textLength: 0,
          pageCount: null,
          fullText: ''
        };
        evidence.potentialIssues = [...new Set([...(evidence.potentialIssues || []), 'DOCUMENT_TEXT_REQUIRES_MANUAL_VERIFICATION'])];
        await evidence.save();
        await logAudit({ req, action: 'DOCUMENT_EXTRACTION_FAILED', entity: 'Evidence', entityId: evidence._id, businessId: evidence.business, metadata: { error: err.message } });
      }
      throw err;
    }
  }
}

module.exports = new DocumentIntelligenceService();
module.exports.POTENTIAL_ISSUE_LABELS = POTENTIAL_ISSUE_LABELS;
module.exports.MISSING_INFORMATION_LABELS = MISSING_INFORMATION_LABELS;
module.exports.OCR_UNAVAILABLE_NOTICE = OCR_UNAVAILABLE_NOTICE;
