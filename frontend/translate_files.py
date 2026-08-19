import os
import glob

replacements = {
    # Dashboard strings
    '>Total Users<': '>{t("admin.totalUsers", "Total Users")}<',
    '>Active Businesses<': '>{t("admin.activeBusinesses", "Active Businesses")}<',
    '>Active Rule Packs<': '>{t("admin.activeRulePacks", "Active Rule Packs")}<',
    '>Recent System Activity<': '>{t("admin.recentActivity", "Recent System Activity")}<',
    '>No recent activity.<': '>{t("admin.noRecentActivity", "No recent activity.")}<',
    '>No business profile configured yet<': '>{t("dash.noBusinessProfile", "No business profile configured yet")}<',
    '>Complete your business profile to generate applicable compliance obligations. Our deterministic rules engine requires this information to accurately assess your regulatory requirements.<': '>{t("dash.profileRequiredText", "Complete your business profile to generate applicable compliance obligations. Our deterministic rules engine requires this information to accurately assess your regulatory requirements.")}<',
    '>Complete Business Profile<': '>{t("dash.completeProfileBtn", "Complete Business Profile")}<',
    '>View Regulatory Impacts<': '>{t("dash.viewRegulatoryImpacts", "View Regulatory Impacts")}<',
    '>Compliance Alerts &amp; Escalations<': '>{t("dash.alertsHeader", "Compliance Alerts & Escalations")}<',
    '> Compliance Alerts & Escalations<': '>{t("dash.alertsHeader", "Compliance Alerts & Escalations")}<',
    '> Escalations<': '>{t("dash.escalationsLabel", " Escalations")}<',
    '> Overdue Actions<': '>{t("dash.overdueActionsLabel", " Overdue Actions")}<',
    '> Expired Evidence<': '>{t("dash.expiredEvidenceLabel", " Expired Evidence")}<',
    '> Rejected Items<': '>{t("dash.rejectedItemsLabel", " Rejected Items")}<',
    '> Pending Reviews<': '>{t("dash.pendingReviewsLabel", " Pending Reviews")}<',
    '> Due Today<': '>{t("dash.dueTodayLabel", " Due Today")}<',
    '> Due Next 7 Days<': '>{t("dash.dueNext7DaysLabel", " Due Next 7 Days")}<',
    '>Risk Drivers<': '>{t("dash.riskDrivers", "Risk Drivers")}<',
    '>0 risk drivers.<': '>{t("dash.zeroRiskDrivers", "0 risk drivers.")}<',
    '>Recommended Actions<': '>{t("dash.recommendedActions", "Recommended Actions")}<',
    '>No immediate risk-reduction action identified.<': '>{t("dash.noRiskAction", "No immediate risk-reduction action identified.")}<',
    '>Documents to Upload<': '>{t("dash.documentsToUpload", "Documents to Upload")}<',
    '>My Overdue Tasks<': '>{t("dash.myOverdueTasks", "My Overdue Tasks")}<',
    '>My Due Soon<': '>{t("dash.myDueSoon", "My Due Soon")}<',
    '>View Submission<': '>{t("dash.viewSubmission", "View Submission")}<',
    '>No applicable compliance actions available yet.<': '>{t("dash.noApplicableActions", "No applicable compliance actions available yet.")}<',

    # Obligations strings
    '<option value="ALL">All Applicability</option>': '<option value="ALL">{t("obl.allApplicability", "All Applicability")}</option>',
    "d === 'ALL' ? 'All Domains' : d": "d === 'ALL' ? t('obl.allDomains', 'All Domains') : d",
    '<th>Code</th>': '<th>{t("obl.code", "Code")}</th>',
    '<th>Obligation</th>': '<th>{t("obl.obligation", "Obligation")}</th>',
    '<th>Domain</th>': '<th>{t("obl.domain", "Domain")}</th>',
    '<th>Severity</th>': '<th>{t("obl.severity", "Severity")}</th>',
    '<th>Applicability</th>': '<th>{t("obl.applicability", "Applicability")}</th>',
    '<th>Cadence</th>': '<th>{t("obl.cadence", "Cadence")}</th>',
    ">Domain<": ">{t('obl.domain', 'Domain')}<",
    ">Cadence<": ">{t('obl.cadence', 'Cadence')}<",
    ">Severity<": ">{t('obl.severity', 'Severity')}<",
    "{selected.status === 'APPLIES' && 'Why this applies'}": "{selected.status === 'APPLIES' && t('obl.whyApplies', 'Why this applies')}",
    "{selected.status === 'DOES_NOT_APPLY' && 'Why this does not apply'}": "{selected.status === 'DOES_NOT_APPLY' && t('obl.whyNotApplies', 'Why this does not apply')}",
    "{selected.status === 'INSUFFICIENT_DATA' && 'Information required'}": "{selected.status === 'INSUFFICIENT_DATA' && t('obl.infoRequired', 'Information required')}",
    "{selected.explanation || 'Explanation not available.'}": "{selected.explanation || t('obl.explanationNotAvail', 'Explanation not available.')}",
    ">Result<": ">{t('obl.result', 'Result')}<",
    ">Next Steps<": ">{t('obl.nextSteps', 'Next Steps')}<",
    "{selected.action || 'Review the obligation details and required evidence.'}": "{selected.action || t('obl.reviewObligation', 'Review the obligation details and required evidence.')}",
    ">Description<": ">{t('obl.description', 'Description')}<",
    ">Authority<": ">{t('obl.authority', 'Authority')}<",
    ">Jurisdiction<": ">{t('obl.jurisdiction', 'Jurisdiction')}<",
    ">Penalty<": ">{t('obl.penalty', 'Penalty')}<",
    "{selected.penalty || 'Not specified'}": "{selected.penalty || t('obl.notSpecified', 'Not specified')}",
    ">Imprisonment Risk<": ">{t('obl.imprisonmentRisk', 'Imprisonment Risk')}<",
    ">License Suspension<": ">{t('obl.licenseSuspension', 'License Suspension')}<",
    ">Regulatory Source<": ">{t('obl.regulatorySource', 'Regulatory Source')}<",
    "✓ Suraksha Rules Verified": "✓ {t('obl.rulesVerified', 'Suraksha Rules Verified')}",
    "<strong>Source:</strong>": "<strong>{t('obl.source', 'Source')}:</strong>",
    "<strong>Act/Regulation:</strong>": "<strong>{t('obl.actRegulation', 'Act/Regulation')}:</strong>",
    "<strong>Section:</strong>": "<strong>{t('obl.section', 'Section')}:</strong>",
    "<strong>Authority:</strong>": "<strong>{t('obl.authority', 'Authority')}:</strong>",
    ">View Official Source ↗<": ">{t('obl.viewOfficialSource', 'View Official Source ↗')}<",
    ">Source URL not available in the Suraksha Rules engine.<": ">{t('obl.sourceUrlNotAvail', 'Source URL not available in the Suraksha Rules engine.')}<",
    ">Source verification information is not available.<": ">{t('obl.sourceVerifNotAvail', 'Source verification information is not available.')}<",
    'className="card-title" style={{ marginBottom: \'8px\' }}>Evidence<': 'className="card-title" style={{ marginBottom: \'8px\' }}>{t("obl.evidence", "Evidence")}<',
    "Expiry:": "{t('obl.expiry', 'Expiry:')}",
    "Verification:": "{t('obl.verification', 'Verification:')}",
    ">View File<": ">{t('obl.viewFile', 'View File')}<",
    ">Manage<": ">{t('obl.manage', 'Manage')}<",
    "'Not specified'": "t('obl.notSpecified', 'Not specified')",

    # Common UI
    '>Save<': '>{t("ui.save", "Save")}<',
    '>Cancel<': '>{t("ui.cancel", "Cancel")}<',
    '>Close<': '>{t("ui.close", "Close")}<',
    '>Delete<': '>{t("ui.delete", "Delete")}<',
    '>Edit<': '>{t("ui.edit", "Edit")}<',
    '>View<': '>{t("ui.view", "View")}<',
    '>Search<': '>{t("ui.search", "Search")}<',
    '>Filter<': '>{t("ui.filter", "Filter")}<',
    '>Sort<': '>{t("ui.sort", "Sort")}<',
    '>Apply<': '>{t("ui.apply", "Apply")}<',
    '>Reset<': '>{t("ui.reset", "Reset")}<',
    '>Next<': '>{t("ui.next", "Next")}<',
    '>Previous<': '>{t("ui.previous", "Previous")}<',
    '>Submit<': '>{t("ui.submit", "Submit")}<',
    '>Confirm<': '>{t("ui.confirm", "Confirm")}<',
    '>Back<': '>{t("ui.back", "Back")}<',
    '>Continue<': '>{t("ui.continue", "Continue")}<',
    '>Loading...<': '>{t("ui.loading", "Loading...")}<',
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

files = glob.glob('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/**/*.tsx', recursive=True)
for file in files:
    process_file(file)
