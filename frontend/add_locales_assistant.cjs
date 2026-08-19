const fs = require('fs');

const extractedTranslations = {
  'assistant.title': 'Grounded Compliance Assistant',
  'assistant.documents': 'Documents',
  'assistant.subtitleChat': 'Answers are grounded in the verified obligations and documents on your SurakshaSetu profile.',
  'assistant.subtitleBrowse': 'Explore compliance documents and evidence by category, or ask a specific question.',
  'assistant.searchPlaceholder': 'Search documents or ask a question (e.g., What is GST Registration Certificate?)',
  'assistant.listening': 'Listening…',
  'assistant.askPlaceholder': 'Ask a question about any document…',
  'assistant.quickAccess': 'Quick Access',
  'assistant.showingDocs': 'Showing documents tailored for',
  'assistant.chooseCat': 'Choose a category to find the right documents.',
  'assistant.chooseCatAnswers': 'Choose a category to find the right documents and get detailed answers.',
  'assistant.noDocs': 'No documents',
  'assistant.documentSingular': 'document',
  'assistant.documentsPlural': 'documents',
  'assistant.noProfileTitle': "Your business profile isn't set up yet.",
  'assistant.noProfileDesc': 'The deterministic engine works out which documents you need from your profile. Until that is saved, there are no obligations to list here.',
  'assistant.setupProfile': 'Set up business profile →',
  'assistant.noReqsTitle': 'No document requirements yet.',
  'assistant.noReqsDesc': 'The engine evaluated the active ruleset against your profile and no obligation currently requires a document.',
  'assistant.completeProfile': 'Complete your profile →',
  'assistant.furtherRule': 'further rule',
  'assistant.couldNotDecide': 'could not be decided from your profile.',
  'assistant.completeProfileBtn': 'Complete your profile',
  'assistant.letEngineDecide': 'to let the engine decide.',
  'assistant.totalDocs': 'Total Documents',
  'assistant.missing': 'Missing',
  'assistant.available': 'Available',
  'assistant.inReview': 'In Review',
  'assistant.approved': 'Approved',
  'assistant.allStatus': 'All Status',
  'assistant.sortByPriority': 'Sort by: Priority',
  'assistant.noDocsMatch': 'No documents match your filter.',
  'assistant.unlinked': 'Unlinked',
  'assistant.general': 'General',
  'assistant.asRequired': 'As required',
  'assistant.mandatoryDoc': 'This document is mandatory as per applicable compliance rules for your business.',
  'assistant.aboutDoc': 'About this document',
  'assistant.noDesc': 'No description available for this requirement.',
  'assistant.relatedObl': 'Related Obligation',
  'assistant.oblId': 'Obligation ID:',
  'assistant.reqEvidence': 'Required Evidence',
  'assistant.requirement': 'requirement',
  'assistant.freq': 'Frequency',
  'assistant.monthly': 'Monthly',
  'assistant.dueDate': 'Due Date',
  'assistant.10thNextMonth': '10th of next month',
  'assistant.source': 'Source',
  'assistant.verifiedRegs': 'Verified regulations in SurakshaSetu (Suraksha Rules)',
  'assistant.viewUpload': 'View / Upload Evidence',
  'assistant.askAboutDoc': 'Ask about this document',
  'assistant.penaltyPlaceholder': 'e.g., What is the penalty for not having this?',
  'assistant.askBtn': 'Ask',
  'assistant.docInfo': 'Document information',
  'assistant.reqStatus': 'Requirement status',
  'assistant.backToAll': 'Back to all',
  'assistant.categories': 'categories',
  'assistant.docsRequiredBy': 'Documents required by the applicable compliance rules for your business.',
  'assistant.searchCatPlaceholder': 'Search documents in this category...',
  'assistant.clearSearch': 'Clear search',
  'assistant.resultSingular': ' result',
  'assistant.resultsPlural': ' results',
  'assistant.for': ' for “',
  'assistant.matchedOn': 'Matched on document name, obligation and issuing authority.',
  'assistant.bizMeaning': 'Business meaning',
  'assistant.recAction': 'Recommended action',
  'assistant.prepareDoc': 'Prepare document',
  'assistant.aiExplanation': 'AI explanation (OpenRouter)',
  'assistant.sources': 'Sources (SurakshaSetu)'
};

const dir = 'c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/locales';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = require('path').join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  let toAppend = '';
  for (const [key, val] of Object.entries(extractedTranslations)) {
    if (!content.includes('"' + key + '"') && !content.includes("'" + key + "'")) {
      toAppend += `  "${key}": "${val.replace(/"/g, '\\"')}",\n`;
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
