const fs = require('fs');

const extractedTranslations = {
  'documents.dashSubtitle': 'Draft, manage, and prepare official documents in a few simple steps.',
  'documents.myDash': 'My Document Dashboard',
  'documents.trackDocs': 'Track your documents across all stages of preparation.',
  'documents.searchPlaceholder': 'Search documents...',
  'documents.allStatus': 'All Status',
  'documents.docsNeeded': 'Documents Needed',
  'documents.draftsInProgress': 'Drafts In Progress',
  'documents.awaitingReview': 'Awaiting Review',
  'documents.approved': 'Approved',
  'documents.noMatchFilters': 'No documents match your filters',
  'documents.noDocsYet': 'No documents yet',
  'documents.tryAdjust': 'Try adjusting your search or status filter.',
  'documents.allSetMsg': "You're all set! When the Assistant identifies documents you need,\\nthey will appear here for you to prepare.",
  'documents.createDoc': 'Create New Document',
  'documents.learnMore': 'Learn more about document preparation &rarr;',
  'documents.statusCol': 'Status',
  'documents.actionsCol': 'Actions',
  'documents.prepareBtn': 'Prepare'
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
