const fs = require('fs');

const extractedTranslations = {
  // Common UI
  'ui.save': 'Save',
  'ui.cancel': 'Cancel',
  'ui.close': 'Close',
  'ui.delete': 'Delete',
  'ui.edit': 'Edit',
  'ui.view': 'View',
  'ui.search': 'Search',
  'ui.filter': 'Filter',
  'ui.sort': 'Sort',
  'ui.apply': 'Apply',
  'ui.reset': 'Reset',
  'ui.next': 'Next',
  'ui.previous': 'Previous',
  'ui.submit': 'Submit',
  'ui.confirm': 'Confirm',
  'ui.back': 'Back',
  'ui.continue': 'Continue',
  'ui.loading': 'Loading...',
  'ui.review': 'Review',
  'ui.upload': 'Upload Evidence',
  'ui.viewCalendar': 'View Calendar',
  'ui.viewBreakdown': 'View Breakdown',

  // Dashboard admin & metrics
  'admin.totalUsers': 'Total Users',
  'admin.activeBusinesses': 'Active Businesses',
  'admin.activeRulePacks': 'Active Rule Packs',
  'admin.recentActivity': 'Recent System Activity',
  'admin.noRecentActivity': 'No recent activity.',
  'dash.noBusinessProfile': 'No business profile configured yet',
  'dash.profileRequiredText': 'Complete your business profile to generate applicable compliance obligations. Our deterministic rules engine requires this information to accurately assess your regulatory requirements.',
  'dash.completeProfileBtn': 'Complete Business Profile',
  'dash.viewRegulatoryImpacts': 'View Regulatory Impacts',
  'dash.alertsHeader': 'Compliance Alerts & Escalations',
  'dash.escalationsLabel': ' Escalations',
  'dash.overdueActionsLabel': ' Overdue Actions',
  'dash.expiredEvidenceLabel': ' Expired Evidence',
  'dash.rejectedItemsLabel': ' Rejected Items',
  'dash.pendingReviewsLabel': ' Pending Reviews',
  'dash.dueTodayLabel': ' Due Today',
  'dash.dueNext7DaysLabel': ' Due Next 7 Days',
  'dash.riskDrivers': 'Risk Drivers',
  'dash.zeroRiskDrivers': '0 risk drivers.',
  'dash.recommendedActions': 'Recommended Actions',
  'dash.noRiskAction': 'No immediate risk-reduction action identified.',
  'dash.documentsToUpload': 'Documents to Upload',
  'dash.myOverdueTasks': 'My Overdue Tasks',
  'dash.myDueSoon': 'My Due Soon',
  'dash.viewSubmission': 'View Submission',
  'dash.noApplicableActions': 'No applicable compliance actions available yet.',

  // Obligations UI
  'obl.allApplicability': 'All Applicability',
  'obl.allDomains': 'All Domains',
  'obl.code': 'Code',
  'obl.obligation': 'Obligation',
  'obl.domain': 'Domain',
  'obl.severity': 'Severity',
  'obl.applicability': 'Applicability',
  'obl.cadence': 'Cadence',
  'obl.whyApplies': 'Why this applies',
  'obl.whyNotApplies': 'Why this does not apply',
  'obl.infoRequired': 'Information required',
  'obl.explanationNotAvail': 'Explanation not available.',
  'obl.result': 'Result',
  'obl.nextSteps': 'Next Steps',
  'obl.reviewObligation': 'Review the obligation details and required evidence.',
  'obl.description': 'Description',
  'obl.authority': 'Authority',
  'obl.jurisdiction': 'Jurisdiction',
  'obl.penalty': 'Penalty',
  'obl.notSpecified': 'Not specified',
  'obl.imprisonmentRisk': 'Imprisonment Risk',
  'obl.licenseSuspension': 'License Suspension',
  'obl.regulatorySource': 'Regulatory Source',
  'obl.rulesVerified': 'Suraksha Rules Verified',
  'obl.source': 'Source',
  'obl.actRegulation': 'Act/Regulation',
  'obl.section': 'Section',
  'obl.viewOfficialSource': 'View Official Source ↗',
  'obl.sourceUrlNotAvail': 'Source URL not available in the Suraksha Rules engine.',
  'obl.sourceVerifNotAvail': 'Source verification information is not available.',
  'obl.evidence': 'Evidence',
  'obl.expiry': 'Expiry:',
  'obl.verification': 'Verification:',
  'obl.viewFile': 'View File',
  'obl.manage': 'Manage',
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
