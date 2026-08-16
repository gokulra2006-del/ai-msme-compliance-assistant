const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Evidence = require('../models/Evidence');
const ComplianceAction = require('../models/ComplianceAction');
const ComplianceRule = require('../models/ComplianceRule');
const { UPLOAD_DIR } = require('../middleware/upload');
const { logAudit } = require('../utils/auditLogger');

const KEYWORDS = {
  LICENCE: ['licence', 'license', 'factory licence', 'factory license'],
  CERTIFICATE: ['certificate', 'certified'],
  REGISTRATION: ['registration', 'udyam', 'registered'],
  NOTICE: ['notice', 'show cause', 'memorandum'],
  RETURN: ['return', 'monthly return', 'annual return'],
  DECLARATION: ['declaration', 'declared'],
  INSPECTION_REPORT: ['inspection report', 'inspection', 'inspection memo'],
  ENVIRONMENTAL_DOCUMENT: ['environmental', 'pollution', 'consent to operate', 'consent to establish'],
  LABOUR_DOCUMENT: ['labour', 'labor', 'employee', 'wage', 'epf', 'esi'],
  TAX_DOCUMENT: ['gst', 'tax', 'gstin']
};

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

function extractText(evidence) {
  const filePath = path.join(UPLOAD_DIR, evidence.filePath);
  if (!fs.existsSync(filePath)) throw new Error('Uploaded file is not available for analysis.');
  if (evidence.mimeType === 'application/pdf') {
    const text = extractPdfText(fs.readFileSync(filePath));
    return text
      ? { text, notice: 'Text was extracted from this PDF. Review extracted values before relying on them.' }
      : { text: '', notice: 'Document text could not be reliably extracted. Please verify manually.' };
  }
  return {
    text: '',
    notice: 'Image OCR is not configured in the installed project stack. Please verify this document manually.'
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

function field(fieldName, value, confidence, originalText) {
  return { field: fieldName, value: String(value).trim(), confidence, originalText: String(originalText || value).trim() };
}

function extractMetadata(text, originalFileName) {
  if (!text) return [];
  const fields = [];
  const addUnique = item => {
    if (item.value && !fields.some(existing => existing.field === item.field && existing.value === item.value)) fields.push(item);
  };

  const gstin = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/);
  if (gstin) addUnique(field('gstin', gstin[0], 98, gstin[0]));

  const udyam = text.match(/\bUDYAM-[A-Z]{2}-\d{2}-\d{7}\b/i);
  if (udyam) addUnique(field('udyamRegistration', udyam[0].toUpperCase(), 98, udyam[0]));

  const numberPattern = /(?:licen[cs]e|registration|certificate)\s*(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,})/ig;
  for (const match of text.matchAll(numberPattern)) addUnique(field('documentNumber', match[1], 82, match[0]));

  const authority = text.match(/(?:issued\s+by|issuing\s+authority)\s*[:\-]\s*([^\n]{3,90})/i);
  if (authority) addUnique(field('issuingAuthority', cleanText(authority[1]), 76, authority[0]));

  const datePatterns = [
    { name: 'issueDate', pattern: /(?:issue\s+date|issued\s+on|date\s+of\s+issue)\s*[:\-]?\s*(\d{1,2}[\-/.]\d{1,2}[\-/.]\d{4}|\d{4}[\-/.]\d{1,2}[\-/.]\d{1,2})/ig },
    { name: 'expiryDate', pattern: /(?:expiry\s+date|expires?\s+on|valid\s+(?:till|until|up\s+to))\s*[:\-]?\s*(\d{1,2}[\-/.]\d{1,2}[\-/.]\d{4}|\d{4}[\-/.]\d{1,2}[\-/.]\d{1,2})/ig },
    { name: 'renewalDate', pattern: /(?:renewal\s+date|renew\s+by)\s*[:\-]?\s*(\d{1,2}[\-/.]\d{1,2}[\-/.]\d{4}|\d{4}[\-/.]\d{1,2}[\-/.]\d{1,2})/ig }
  ];
  for (const datePattern of datePatterns) {
    for (const match of text.matchAll(datePattern.pattern)) {
      const parsed = parseDate(match[1]);
      if (parsed) addUnique(field(datePattern.name, parsed.toISOString().slice(0, 10), 88, match[0]));
    }
  }

  const filename = path.basename(originalFileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (filename) addUnique(field('documentTitle', filename, 45, filename));
  return fields;
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
    status: 'POSSIBLE_MATCH',
    obligationCode: best.rule.ruleCode,
    obligationTitle: best.rule.title,
    confidence: Math.min(94, 58 + best.score * 9 + (classification.confidence >= 70 ? 10 : 0))
  };
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
      const potentialIssues = [];
      if (!extraction.text) potentialIssues.push('DOCUMENT_TEXT_REQUIRES_MANUAL_VERIFICATION');
      if (classification.documentType === 'UNKNOWN' || classification.confidence < 65) potentialIssues.push('CLASSIFICATION_REQUIRES_REVIEW');
      if (extractedFields.length === 0) potentialIssues.push('NO_RELIABLE_METADATA_EXTRACTED');
      const expiryField = extractedFields.find(item => item.field === 'expiryDate');
      if (expiryField && new Date(expiryField.value) < new Date()) potentialIssues.push('DOCUMENT_APPEARS_EXPIRED');

      evidence.classification = classification;
      evidence.extractedFields = extractedFields;
      evidence.obligationMatch = obligationMatch;
      evidence.relatedObligationSuggestion = obligationMatch.obligationCode || null;
      evidence.extraction = {
        textAvailable: Boolean(extraction.text),
        textPreview: extraction.text ? extraction.text.slice(0, 500) : '',
        notice: extraction.notice
      };
      evidence.potentialIssues = potentialIssues;
      if (!evidence.expiryDate && expiryField?.confidence >= 80) evidence.expiryDate = new Date(expiryField.value);
      evidence.processingStatus = extraction.text ? 'PROCESSED' : 'NEEDS_REVIEW';
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
          extractedFieldCount: extractedFields.length,
          obligationMatch: obligationMatch.obligationCode || null
        }
      });
      if (extractedFields.length) {
        await logAudit({ req, action: 'DOCUMENT_METADATA_EXTRACTED', entity: 'Evidence', entityId: evidence._id, businessId: evidence.business, metadata: { fields: extractedFields.map(item => item.field) } });
      }
      if (obligationMatch.status === 'POSSIBLE_MATCH') {
        await logAudit({ req, action: 'EVIDENCE_OBLIGATION_MATCH_SUGGESTED', entity: 'Evidence', entityId: evidence._id, businessId: evidence.business, metadata: obligationMatch });
      }
      return evidence;
    } catch (err) {
      console.error('Document intelligence failed:', err.message);
      if (evidence) {
        evidence.processingStatus = 'FAILED';
        evidence.extraction = { textAvailable: false, notice: 'Document analysis failed. Please verify manually.' };
        await evidence.save();
        await logAudit({ req, action: 'DOCUMENT_EXTRACTION_FAILED', entity: 'Evidence', entityId: evidence._id, businessId: evidence.business, metadata: { error: err.message } });
      }
      throw err;
    }
  }
}

module.exports = new DocumentIntelligenceService();
