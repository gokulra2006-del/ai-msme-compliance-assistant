const fs = require('fs');

const extractedTranslations = {
  // Digital Twin
  'dt.loading': 'Loading Digital Twin...',
  'dt.noProfile': 'No business profile configured yet.',
  'dt.completeProfile': 'Complete Business Profile',
  'dt.title': 'Compliance Digital Twin',
  'dt.subtitle': 'A real-time mapping of your physical business operations to the deterministic regulatory rules engine.',
  'dt.simulator': 'What-If Simulator',
  'dt.liveAttr': 'Live Business Attributes',
  'dt.name': 'Name',
  'dt.notSet': 'Not set',
  'dt.stateDistrict': 'State / District',
  'dt.industry': 'Industry',
  'dt.totalWorkers': 'Total Workers',
  'dt.contractWorkers': 'Contract Workers',
  'dt.nightShifts': 'Night Shifts',
  'dt.yes': 'Yes',
  'dt.no': 'No',
  'dt.boiler': 'Boiler',
  'dt.effluent': 'Effluent Discharge',
  'dt.traceability': 'Applicable Obligations Traceability',
  'dt.traceabilityDesc': 'Below are the obligations deterministically matched to your business profile. Click "Why?" to trace the exact condition.',
  'dt.source': 'Source:',
  'dt.unknownAct': 'Unknown Act',
  'dt.whyApplies': 'Why does this apply?',
  'dt.noObligations': 'No applicable obligations found.',
  'dt.reasoningChain': 'Reasoning Chain',
  'dt.evalTrace': 'Evaluation Trace',
  'dt.businessProfile': 'Business Profile',
  'dt.ruleCondition': 'Rule Condition',
  'dt.required': 'Required:',
  'dt.outcome': 'Outcome',
  'dt.ruleTriggered': 'Rule Triggered: APPLIES',

  // Inspection Readiness
  'ir.analyzing': 'Analyzing compliance data against Suraksha Rules engine...',
  'ir.insufficientData': 'Insufficient Data',
  'ir.insufficientDataDesc': 'We don\'t have enough compliance action data to calculate inspection readiness yet. Please complete your business profile and ensure the Rules Engine has run.',
  'ir.goToProfile': 'Go to Business Profile',
  'ir.simTitle': 'Simulated Inspection Readiness Assessment',
  'ir.simDesc': 'This mode presents your live compliance data as inspection-style checkpoints. This is not an actual government inspection.',
  'ir.exitSim': 'Exit Simulation',
  'ir.subtitle': 'Deterministically calculated from your live compliance data using Suraksha Rules.',
  'ir.generatePack': 'Generate Inspection Pack',
  'ir.overall': 'OVERALL INSPECTION READINESS',
  'ir.baseScore': '100% Base Score',
  'ir.whyScore': 'Why is my score this',
  'ir.low': 'low',
  'ir.high': 'high',
  'ir.missingCritical': 'Missing/Expired Critical:',
  'ir.minus10Each': '-10% each',
  'ir.missingHigh': 'Missing/Expired High:',
  'ir.minus5Each': '-5% each',
  'ir.overdueActions': 'Overdue Actions:',
  'ir.rejected': 'Rejected',
  'ir.needsReupload': 'Needs re-upload',
  'ir.missing': 'Missing',
  'ir.reqCompliance': 'Required for compliance',
  'ir.expiring': 'Expiring / Expired',
  'ir.actionReq': 'Action required soon',
  'ir.priorityQueue': 'Inspection Priority Queue',
  'ir.priority': 'PRIORITY',
  'ir.obligationLbl': 'OBLIGATION:',
  'ir.theIssue': 'THE ISSUE:',
  'ir.whyMatters': 'WHY IT MATTERS:',
  'ir.missingLbl': 'MISSING:',
  'ir.actionLbl': 'ACTION:',
  'ir.whoWhen': 'WHO & WHEN:',
  'ir.sourceLbl': 'SOURCE:',
  'ir.uploadEvidence': 'Upload Evidence',
  'ir.viewAction': 'View Action',
  'ir.missingChecklist': 'Missing Documents Checklist',
  'ir.deptView': 'Department View:',
  'ir.noMissingDocs': 'No missing required documents in this department!',
  'ir.obligation': 'Obligation:',
  'ir.whyRequired': 'WHY IS IT REQUIRED?',
  'ir.source': 'SOURCE',
  'ir.responsible': 'Responsible:',
  'ir.unassigned': 'Unassigned',
  'ir.prepareDraft': 'Prepare Draft',
  'ir.evidenceReview': 'Evidence Requiring Review',
  'ir.noEvidenceReview': 'No evidence requires human verification currently.',
  'ir.uploadedBy': 'Uploaded by',
  'ir.reviewEvidenceBtn': 'Review Evidence',
  'ir.deptStatus': 'Department-Wise Compliance Status',
  'ir.severityCol': 'Severity',
  'ir.statusCol': 'Submission Status',
  'ir.noObligations': 'No obligations in this department.',
  'ir.beforeChecklist': 'Before Inspection Checklist',
  'ir.chkScore': 'Readiness score > 90%',
  'ir.chkEvidence': 'All Required evidence available',
  'ir.chkExpired': 'Expired evidence identified & replaced',
  'ir.chkReview': 'Unverified evidence reviewed by human',
  'ir.chkActions': 'Open corrective actions reviewed',
  'ir.chkIssues': 'High-risk issues addressed',
  'ir.openActions': 'Open Corrective Actions',
  'ir.noActions': 'No unresolved corrective actions.',
  'ir.due': 'Due:',
  'ir.expiredChecklist': 'Expired Evidence Checklist',
  'ir.risk': 'Risk:',
  'ir.action': 'Action:',
  'ir.noExpired': 'No expired evidence.',
  'ir.recentChanges': 'Recent Regulatory Changes',
  'ir.effective': 'Effective:',
  'ir.gazette': 'Government Gazette',
  'ir.noChanges': 'No verified relevant regulatory changes available.',

  // Simulator
  'sim.loadingProfile': 'Loading profile...',
  'sim.noProfile': 'No business profile found',
  'sim.noProfileDesc': 'The simulator needs an existing business profile before it can calculate compliance impact.',
  'sim.title': 'What-If Compliance Simulator',
  'sim.subtitle': 'Preview the deterministic compliance impact of a potential business change WITHOUT modifying your actual records.',
  'sim.runSim': 'Run Simulation',
  'sim.history': 'History',
  'sim.scenarioSelect': '1. Select a Scenario',
  'sim.hire20': 'Hire 20 Employees',
  'sim.installBoiler': 'Install Boiler',
  'sim.nightShift': 'Start Night Shift',
  'sim.exporting': 'Start Exporting',
  'sim.editManual': '2. Or Edit Variables Manually',
  'sim.totalEmp': 'Total Employees',
  'sim.state': 'State',
  'sim.stateMH': 'Maharashtra',
  'sim.stateTN': 'Tamil Nadu',
  'sim.stateKA': 'Karnataka',
  'sim.stateGJ': 'Gujarat',
  'sim.stateHR': 'Haryana',
  'sim.industry': 'Industry',
  'sim.indMfg': 'Manufacturing',
  'sim.indIT': 'IT/Software',
  'sim.indFood': 'Food Processing',
  'sim.indPharma': 'Pharmaceutical',
  'sim.runBtn': 'Run Deterministic Simulation',
  'sim.bizChange': 'Business Change',
  'sim.curVsSim': 'CURRENT STATE versus SIMULATED STATE',
  'sim.noChangesSelected': 'No changes selected yet.',
  'sim.clearChanges': 'Clear Changes',
  'sim.simResult': 'Simulated Result',
  'sim.riskDelta': 'Current Risk Delta:',
  'sim.points': 'Points',
  'sim.discard': 'Discard',
  'sim.applyChanges': 'Apply Real Changes',
  'sim.summary': 'What-If Summary',
  'sim.newObligations': 'New Obligations',
  'sim.removedObligations': 'Removed Obligations',
  'sim.evidenceImpact': 'Evidence Impact',
  'sim.simCalendar': 'Simulated Calendar',
  'sim.notActive': 'NOT ACTIVE',
  'sim.noNewRequirements': 'No new compliance requirements triggered.',
  'sim.source': 'Source:',
  'sim.freq': 'Freq:',
  'sim.noExistingRemoved': 'No existing obligations removed.',
  'sim.askAI': 'Ask AI About This Simulation',
  'sim.aiDesc': 'The AI is fully grounded in the Suraksha Rules engine and the deterministic results above. Ask it to explain the changes, why specific rules triggered, or what documents you need.',
  'sim.analyzing': 'Analyzing...',
  'sim.noAIExplanation': 'No AI explanation requested yet.',
  'sim.aiPlaceholder': 'E.g., Why did risk increase by 15 points?',
  'sim.askAIBtn': 'Ask AI',
  'sim.noHistory': 'No simulation history found.',
  'sim.newObligationsText': 'new obligations',
  'sim.riskText': 'Risk '
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
