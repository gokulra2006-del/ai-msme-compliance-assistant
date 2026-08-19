import os
import glob

replacements = {
    ">Analyzing compliance data against Suraksha Rules engine...<": ">{t('ir.analyzing', 'Analyzing compliance data against Suraksha Rules engine...')}<",
    ">Insufficient Data<": ">{t('ir.insufficientData', 'Insufficient Data')}<",
    ">We don't have enough compliance action data to calculate inspection readiness yet. Please complete your business profile and ensure the Rules Engine has run.<": ">{t('ir.insufficientDataDesc', 'We don\\'t have enough compliance action data to calculate inspection readiness yet. Please complete your business profile and ensure the Rules Engine has run.')}<",
    ">Go to Business Profile<": ">{t('ir.goToProfile', 'Go to Business Profile')}<",
    ">Simulated Inspection Readiness Assessment<": ">{t('ir.simTitle', 'Simulated Inspection Readiness Assessment')}<",
    ">This mode presents your live compliance data as inspection-style checkpoints. This is not an actual government inspection.<": ">{t('ir.simDesc', 'This mode presents your live compliance data as inspection-style checkpoints. This is not an actual government inspection.')}<",
    ">Exit Simulation<": ">{t('ir.exitSim', 'Exit Simulation')}<",
    ">Deterministically calculated from your live compliance data using Suraksha Rules.<": ">{t('ir.subtitle', 'Deterministically calculated from your live compliance data using Suraksha Rules.')}<",
    "Generate Inspection Pack": "{t('ir.generatePack', 'Generate Inspection Pack')}",
    ">OVERALL INSPECTION READINESS<": ">{t('ir.overall', 'OVERALL INSPECTION READINESS')}<",
    ">100% Base Score<": ">{t('ir.baseScore', '100% Base Score')}<",
    ">Why is my score this<": ">{t('ir.whyScore', 'Why is my score this')}<",
    ">low<": ">{t('ir.low', 'low')}<",
    ">high<": ">{t('ir.high', 'high')}<",
    "Missing/Expired Critical:": "{t('ir.missingCritical', 'Missing/Expired Critical:')}",
    "-10% each": "{t('ir.minus10Each', '-10% each')}",
    "Missing/Expired High:": "{t('ir.missingHigh', 'Missing/Expired High:')}",
    "-5% each": "{t('ir.minus5Each', '-5% each')}",
    "Overdue Actions:": "{t('ir.overdueActions', 'Overdue Actions:')}",
    ">Rejected<": ">{t('ir.rejected', 'Rejected')}<",
    ">Needs re-upload<": ">{t('ir.needsReupload', 'Needs re-upload')}<",
    ">Missing<": ">{t('ir.missing', 'Missing')}<",
    ">Required for compliance<": ">{t('ir.reqCompliance', 'Required for compliance')}<",
    ">Expiring / Expired<": ">{t('ir.expiring', 'Expiring / Expired')}<",
    ">Action required soon<": ">{t('ir.actionReq', 'Action required soon')}<",
    ">Inspection Priority Queue<": ">{t('ir.priorityQueue', 'Inspection Priority Queue')}<",
    "PRIORITY": "{t('ir.priority', 'PRIORITY')}",
    "OBLIGATION:": "{t('ir.obligationLbl', 'OBLIGATION:')}",
    "THE ISSUE:": "{t('ir.theIssue', 'THE ISSUE:')}",
    "WHY IT MATTERS:": "{t('ir.whyMatters', 'WHY IT MATTERS:')}",
    "MISSING:": "{t('ir.missingLbl', 'MISSING:')}",
    "ACTION:": "{t('ir.actionLbl', 'ACTION:')}",
    "WHO & WHEN:": "{t('ir.whoWhen', 'WHO & WHEN:')}",
    "SOURCE:": "{t('ir.sourceLbl', 'SOURCE:')}",
    ">Upload Evidence<": ">{t('ir.uploadEvidence', 'Upload Evidence')}<",
    ">View Action<": ">{t('ir.viewAction', 'View Action')}<",
    ">Missing Documents Checklist<": ">{t('ir.missingChecklist', 'Missing Documents Checklist')}<",
    ">Department View:<": ">{t('ir.deptView', 'Department View:')}<",
    ">No missing required documents in this department!<": ">{t('ir.noMissingDocs', 'No missing required documents in this department!')}<",
    ">Obligation:<": ">{t('ir.obligation', 'Obligation:')}<",
    "WHY IS IT REQUIRED?": "{t('ir.whyRequired', 'WHY IS IT REQUIRED?')}",
    "SOURCE": "{t('ir.source', 'SOURCE')}",
    "Responsible:": "{t('ir.responsible', 'Responsible:')}",
    ">Unassigned<": ">{t('ir.unassigned', 'Unassigned')}<",
    ">Prepare Draft<": ">{t('ir.prepareDraft', 'Prepare Draft')}<",
    ">Evidence Requiring Review<": ">{t('ir.evidenceReview', 'Evidence Requiring Review')}<",
    ">No evidence requires human verification currently.<": ">{t('ir.noEvidenceReview', 'No evidence requires human verification currently.')}<",
    "Uploaded by": "{t('ir.uploadedBy', 'Uploaded by')}",
    ">Review Evidence<": ">{t('ir.reviewEvidenceBtn', 'Review Evidence')}<",
    ">Department-Wise Compliance Status<": ">{t('ir.deptStatus', 'Department-Wise Compliance Status')}<",
    "<th>Severity</th>": "<th>{t('ir.severityCol', 'Severity')}</th>",
    "<th>Submission Status</th>": "<th>{t('ir.statusCol', 'Submission Status')}</th>",
    ">No obligations in this department.<": ">{t('ir.noObligations', 'No obligations in this department.')}<",
    ">Before Inspection Checklist<": ">{t('ir.beforeChecklist', 'Before Inspection Checklist')}<",
    ">Readiness score > 90%<": ">{t('ir.chkScore', 'Readiness score > 90%')}<",
    ">All Required evidence available<": ">{t('ir.chkEvidence', 'All Required evidence available')}<",
    ">Expired evidence identified & replaced<": ">{t('ir.chkExpired', 'Expired evidence identified & replaced')}<",
    ">Unverified evidence reviewed by human<": ">{t('ir.chkReview', 'Unverified evidence reviewed by human')}<",
    ">Open corrective actions reviewed<": ">{t('ir.chkActions', 'Open corrective actions reviewed')}<",
    ">High-risk issues addressed<": ">{t('ir.chkIssues', 'High-risk issues addressed')}<",
    ">Open Corrective Actions<": ">{t('ir.openActions', 'Open Corrective Actions')}<",
    ">No unresolved corrective actions.<": ">{t('ir.noActions', 'No unresolved corrective actions.')}<",
    "Due:": "{t('ir.due', 'Due:')}",
    ">Expired Evidence Checklist<": ">{t('ir.expiredChecklist', 'Expired Evidence Checklist')}<",
    "Risk:": "{t('ir.risk', 'Risk:')}",
    "Action:": "{t('ir.action', 'Action:')}",
    ">No expired evidence.<": ">{t('ir.noExpired', 'No expired evidence.')}<",
    ">Recent Regulatory Changes<": ">{t('ir.recentChanges', 'Recent Regulatory Changes')}<",
    "Effective:": "{t('ir.effective', 'Effective:')}",
    ">Government Gazette<": ">{t('ir.gazette', 'Government Gazette')}<",
    ">No verified relevant regulatory changes available.<": ">{t('ir.noChanges', 'No verified relevant regulatory changes available.')}<"
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

files = glob.glob('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/pages/InspectionReadiness.tsx', recursive=True)
for file in files:
    process_file(file)
