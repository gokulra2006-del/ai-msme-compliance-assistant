import os
import glob

replacements = {
    # Evidence Vault specific
    ">Upload Evidence Document<": ">{t('ev.uploadDoc', 'Upload Evidence Document')}<",
    ">Please fill all required fields and select a file.<": ">{t('ev.fillRequired', 'Please fill all required fields and select a file.')}<",
    ">Document uploaded successfully!<": ">{t('ev.uploadSuccess', 'Document uploaded successfully!')}<",
    ">Upload cancelled. A similar document already exists, so nothing was saved.<": ">{t('ev.uploadCancelled', 'Upload cancelled. A similar document already exists, so nothing was saved.')}<",
    ">Are you sure you want to delete this document?<": ">{t('ev.confirmDelete', 'Are you sure you want to delete this document?')}<",
    ">Delete failed<": ">{t('ev.deleteFailed', 'Delete failed')}<",
    ">Submitted for review<": ">{t('ev.submittedReview', 'Submitted for review')}<",
    ">Evidence approved<": ">{t('ev.evidenceApproved', 'Evidence approved')}<",
    ">Rejection reason required<": ">{t('ev.rejectionReasonReq', 'Rejection reason required')}<",
    ">Evidence rejected<": ">{t('ev.evidenceRejected', 'Evidence rejected')}<",
    ">Verification failed<": ">{t('ev.verifFailed', 'Verification failed')}<",
    ">Unable to download this document.<": ">{t('ev.downloadFailed', 'Unable to download this document.')}<",
    ">Document analysis failed. Please verify manually.<": ">{t('ev.analysisFailed', 'Document analysis failed. Please verify manually.')}<",
    ">Correction failed<": ">{t('ev.correctionFailed', 'Correction failed')}<",
    ">⚠️ Complete your business profile first to see required documents.<": ">{t('ev.completeProfile', '⚠️ Complete your business profile first to see required documents.')}<",
    ">Complete Profile →<": ">{t('ev.completeProfileBtn', 'Complete Profile →')}<",
    ">⚠ Missing Documents<": ">{t('ev.missingDocsAlert', '⚠ Missing Documents')}<",
    "Required for:": "{t('ev.requiredFor', 'Required for:')}",
    ">⏰ Expiring / Expired<": ">{t('ev.expiringAlert', '⏰ Expiring / Expired')}<",
    "Expires:": "{t('ev.expires', 'Expires:')}",
    ">All Required Documents<": ">{t('ev.allRequiredDocs', 'All Required Documents')}<",
    "<th>Document</th>": "<th>{t('ev.document', 'Document')}</th>",
    "<th>Status</th>": "<th>{t('ev.status', 'Status')}</th>",
    "<th>Verification</th>": "<th>{t('ev.verification', 'Verification')}</th>",
    "<th>Expiry</th>": "<th>{t('ev.expiry', 'Expiry')}</th>",
    "<th>Action</th>": "<th>{t('ev.action', 'Action')}</th>",
    ">No required documents. Complete your profile to see obligations.<": ">{t('ev.noRequiredDocs', 'No required documents. Complete your profile to see obligations.')}<",
    ">Details<": ">{t('ev.details', 'Details')}<",
    ">File<": ">{t('ev.file', 'File')}<",
    ">Analyze<": ">{t('ev.analyze', 'Analyze')}<",
    ">Verify<": ">{t('ev.verify', 'Verify')}<",
    ">Obligation *<": ">{t('ev.obligationLbl', 'Obligation *')}<",
    ">Select obligation...<": ">{t('ev.selectObligation', 'Select obligation...')}<",
    ">Document Type *<": ">{t('ev.docTypeLbl', 'Document Type *')}<",
    ">Select type...<": ">{t('ev.selectType', 'Select type...')}<",
    ">Document Name *<": ">{t('ev.docNameLbl', 'Document Name *')}<",
    ">File (PDF, JPG, PNG — max 10MB) *<": ">{t('ev.fileLbl', 'File (PDF, JPG, PNG — max 10MB) *')}<",
    ">Issue Date<": ">{t('ev.issueDate', 'Issue Date')}<",
    ">Expiry Date<": ">{t('ev.expiryDate', 'Expiry Date')}<",
    ">Notes<": ">{t('ev.notes', 'Notes')}<",
    "{uploadLoading ? 'Uploading...' : 'Upload Document'}": "{uploadLoading ? t('ev.uploading', 'Uploading...') : t('ev.uploadDoc', 'Upload Document')}",
    "Processing Status:": "{t('ev.processingStatus', 'Processing Status:')}",
    ">Submit for Review<": ">{t('ev.submitReview', 'Submit for Review')}<",
    ">Approve<": ">{t('ev.approve', 'Approve')}<",
    ">Reject<": ">{t('ev.reject', 'Reject')}<",
    ">Classification<": ">{t('ev.classification', 'Classification')}<",
    ">Type Detected<": ">{t('ev.typeDetected', 'Type Detected')}<",
    ">Confidence<": ">{t('ev.confidence', 'Confidence')}<",
    ">Missing Information<": ">{t('ev.missingInfo', 'Missing Information')}<",
    ">Extracted Metadata & Correction<": ">{t('ev.extractedMeta', 'Extracted Metadata & Correction')}<",
    ">Corrected<": ">{t('ev.corrected', 'Corrected')}<",
    "placeholder={`Extracted: ${field.value || 'None'}`}": "placeholder={`${t('ev.extracted', 'Extracted:')} ${field.value || 'None'}`}",
    "{correctionLoading ? 'Saving...' : 'Save Corrections'}": "{correctionLoading ? t('ev.saving', 'Saving...') : t('ev.saveCorrections', 'Save Corrections')}",
    ">No metadata extracted automatically.<": ">{t('ev.noMeta', 'No metadata extracted automatically.')}<",
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False
    for k, v in replacements.items():
        if k in content:
            content = content.replace(k, v)
            changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

files = glob.glob('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/pages/EvidenceVault.tsx', recursive=True)
for file in files:
    process_file(file)
