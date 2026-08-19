const fs = require('fs');

const extractedTranslations = {
  // Evidence Vault specific
  'ev.uploadDoc': 'Upload Evidence Document',
  'ev.fillRequired': 'Please fill all required fields and select a file.',
  'ev.uploadSuccess': 'Document uploaded successfully!',
  'ev.uploadCancelled': 'Upload cancelled. A similar document already exists, so nothing was saved.',
  'ev.confirmDelete': 'Are you sure you want to delete this document?',
  'ev.deleteFailed': 'Delete failed',
  'ev.submittedReview': 'Submitted for review',
  'ev.evidenceApproved': 'Evidence approved',
  'ev.rejectionReasonReq': 'Rejection reason required',
  'ev.evidenceRejected': 'Evidence rejected',
  'ev.verifFailed': 'Verification failed',
  'ev.downloadFailed': 'Unable to download this document.',
  'ev.analysisFailed': 'Document analysis failed. Please verify manually.',
  'ev.correctionFailed': 'Correction failed',
  'ev.completeProfile': '⚠️ Complete your business profile first to see required documents.',
  'ev.completeProfileBtn': 'Complete Profile →',
  'ev.missingDocsAlert': '⚠ Missing Documents',
  'ev.requiredFor': 'Required for:',
  'ev.expiringAlert': '⏰ Expiring / Expired',
  'ev.expires': 'Expires:',
  'ev.allRequiredDocs': 'All Required Documents',
  'ev.document': 'Document',
  'ev.status': 'Status',
  'ev.verification': 'Verification',
  'ev.expiry': 'Expiry',
  'ev.action': 'Action',
  'ev.noRequiredDocs': 'No required documents. Complete your profile to see obligations.',
  'ev.details': 'Details',
  'ev.file': 'File',
  'ev.analyze': 'Analyze',
  'ev.verify': 'Verify',
  'ev.obligationLbl': 'Obligation *',
  'ev.selectObligation': 'Select obligation...',
  'ev.docTypeLbl': 'Document Type *',
  'ev.selectType': 'Select type...',
  'ev.docNameLbl': 'Document Name *',
  'ev.fileLbl': 'File (PDF, JPG, PNG — max 10MB) *',
  'ev.issueDate': 'Issue Date',
  'ev.expiryDate': 'Expiry Date',
  'ev.notes': 'Notes',
  'ev.uploading': 'Uploading...',
  'ev.processingStatus': 'Processing Status:',
  'ev.submitReview': 'Submit for Review',
  'ev.approve': 'Approve',
  'ev.reject': 'Reject',
  'ev.classification': 'Classification',
  'ev.typeDetected': 'Type Detected',
  'ev.confidence': 'Confidence',
  'ev.missingInfo': 'Missing Information',
  'ev.extractedMeta': 'Extracted Metadata & Correction',
  'ev.corrected': 'Corrected',
  'ev.extracted': 'Extracted:',
  'ev.saving': 'Saving...',
  'ev.saveCorrections': 'Save Corrections',
  'ev.noMeta': 'No metadata extracted automatically.',
};

const dir = 'c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/locales';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = require('path').join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  let toAppend = '';
  for (const [key, val] of Object.entries(extractedTranslations)) {
    if (!content.includes('"' + key + '"') && !content.includes("'" + key + "'")) {
      toAppend += `  "${key}": "${val}",\n`;
    }
  }
  
  if (toAppend) {
    const lastBraceIndex = content.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      const beforeBrace = content.substring(0, lastBraceIndex);
      let newBeforeBrace = beforeBrace;
      if (!beforeBrace.trim().endsWith(',')) {
        newBeforeBrace = beforeBrace.trimEnd() + ',\n';
      }
      content = newBeforeBrace + toAppend + content.substring(lastBraceIndex);
      fs.writeFileSync(filePath, content);
      console.log('Added keys to ' + file);
    }
  }
});
