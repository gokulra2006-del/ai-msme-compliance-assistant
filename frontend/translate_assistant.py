import os
import glob
import re

replacements = {
    ">Grounded Compliance Assistant<": ">{t('assistant.title', 'Grounded Compliance Assistant')}<",
    ">Documents<": ">{t('assistant.documents', 'Documents')}<",
    ">Answers are grounded in the verified obligations and documents on your SurakshaSetu profile.<": ">{t('assistant.subtitleChat', 'Answers are grounded in the verified obligations and documents on your SurakshaSetu profile.')}<",
    ">Explore compliance documents and evidence by category, or ask a specific question.<": ">{t('assistant.subtitleBrowse', 'Explore compliance documents and evidence by category, or ask a specific question.')}<",
    "placeholder=\"Search documents or ask a question (e.g., What is GST Registration Certificate?)\"": "placeholder={t('assistant.searchPlaceholder', 'Search documents or ask a question (e.g., What is GST Registration Certificate?)')}",
    "placeholder={isListening ? 'Listening…' : 'Ask a question about any document…'}": "placeholder={isListening ? t('assistant.listening', 'Listening…') : t('assistant.askPlaceholder', 'Ask a question about any document…')}",
    ">Send<": ">{t('ui.send', 'Send')}<",
    ">Sending<": ">{t('ui.sending', 'Sending')}<",
    ">Quick Access<": ">{t('assistant.quickAccess', 'Quick Access')}<",
    ">Showing documents tailored for<": ">{t('assistant.showingDocs', 'Showing documents tailored for')}<",
    "Choose a category to find the right documents.": "{t('assistant.chooseCat', 'Choose a category to find the right documents.')}",
    ">Choose a category to find the right documents and get detailed answers.<": ">{t('assistant.chooseCatAnswers', 'Choose a category to find the right documents and get detailed answers.')}<",
    ">Loading…<": ">{t('ui.loading', 'Loading…')}<",
    "'Loading…'": "t('ui.loading', 'Loading…')",
    ">No documents<": ">{t('assistant.noDocs', 'No documents')}<",
    "'No documents'": "t('assistant.noDocs', 'No documents')",
    " document": " {t('assistant.documentSingular', 'document')}",
    " documents": " {t('assistant.documentsPlural', 'documents')}",
    ">Your business profile isn't set up yet.<": ">{t('assistant.noProfileTitle', 'Your business profile isn\\'t set up yet.')}<",
    ">The deterministic engine works out which documents you need from your profile.": ">{t('assistant.noProfileDesc1', 'The deterministic engine works out which documents you need from your profile.')}",
    "Until that is saved, there are no obligations to list here.<": "{t('assistant.noProfileDesc2', 'Until that is saved, there are no obligations to list here.')}<",
    ">Set up business profile →<": ">{t('assistant.setupProfile', 'Set up business profile →')}<",
    ">No document requirements yet.<": ">{t('assistant.noReqsTitle', 'No document requirements yet.')}<",
    ">The engine evaluated the active ruleset against your profile and no obligation": ">{t('assistant.noReqsDesc1', 'The engine evaluated the active ruleset against your profile and no obligation')}",
    "currently requires a document.<": "{t('assistant.noReqsDesc2', 'currently requires a document.')}<",
    ">Complete your profile →<": ">{t('assistant.completeProfile', 'Complete your profile →')}<",
    " further rule": " {t('assistant.furtherRule', 'further rule')}",
    " could not be decided from": " {t('assistant.couldNotDecide', 'could not be decided from')}",
    "your profile.": "{t('assistant.yourProfile', 'your profile.')}",
    ">Complete your profile<": ">{t('assistant.completeProfileBtn', 'Complete your profile')}<",
    " to let the engine decide.": " {t('assistant.letEngineDecide', 'to let the engine decide.')}",
    ">Total Documents<": ">{t('assistant.totalDocs', 'Total Documents')}<",
    ">Missing<": ">{t('assistant.missing', 'Missing')}<",
    ">Available<": ">{t('assistant.available', 'Available')}<",
    ">In Review<": ">{t('assistant.inReview', 'In Review')}<",
    ">Approved<": ">{t('assistant.approved', 'Approved')}<",
    ">All Status<": ">{t('assistant.allStatus', 'All Status')}<",
    "Sort by: Priority": "{t('assistant.sortByPriority', 'Sort by: Priority')}",
    ">No documents match your filter.<": ">{t('assistant.noDocsMatch', 'No documents match your filter.')}<",
    ">Unlinked<": ">{t('assistant.unlinked', 'Unlinked')}<",
    "'Unlinked'": "t('assistant.unlinked', 'Unlinked')",
    ">General<": ">{t('assistant.general', 'General')}<",
    "'General'": "t('assistant.general', 'General')",
    ">As required<": ">{t('assistant.asRequired', 'As required')}<",
    "'As required'": "t('assistant.asRequired', 'As required')",
    ">This document is mandatory as per applicable compliance rules for your business.<": ">{t('assistant.mandatoryDoc', 'This document is mandatory as per applicable compliance rules for your business.')}<",
    ">About this document<": ">{t('assistant.aboutDoc', 'About this document')}<",
    "No description available for this requirement.": "{t('assistant.noDesc', 'No description available for this requirement.')}",
    ">Related Obligation<": ">{t('assistant.relatedObl', 'Related Obligation')}<",
    "Obligation ID:": "{t('assistant.oblId', 'Obligation ID:')}",
    ">Required Evidence<": ">{t('assistant.reqEvidence', 'Required Evidence')}<",
    " requirement<": " {t('assistant.requirement', 'requirement')}<",
    ">Frequency<": ">{t('assistant.freq', 'Frequency')}<",
    "'Monthly'": "t('assistant.monthly', 'Monthly')",
    ">Due Date<": ">{t('assistant.dueDate', 'Due Date')}<",
    "'10th of next month'": "t('assistant.10thNextMonth', '10th of next month')",
    ">Source<": ">{t('assistant.source', 'Source')}<",
    "Verified regulations in SurakshaSetu (Suraksha Rules)": "{t('assistant.verifiedRegs', 'Verified regulations in SurakshaSetu (Suraksha Rules)')}",
    "> View / Upload Evidence<": "> {t('assistant.viewUpload', 'View / Upload Evidence')}<",
    ">Ask about this document<": ">{t('assistant.askAboutDoc', 'Ask about this document')}<",
    "placeholder=\"e.g., What is the penalty for not having this?\"": "placeholder={t('assistant.penaltyPlaceholder', 'e.g., What is the penalty for not having this?')}",
    ">Ask<": ">{t('assistant.askBtn', 'Ask')}<",
    ">Document information<": ">{t('assistant.docInfo', 'Document information')}<",
    "\"Requirement status\"": "t('assistant.reqStatus', 'Requirement status')",
    ">Back to all<br/>categories<": ">{t('assistant.backToAll', 'Back to all')}<br/>{t('assistant.categories', 'categories')}<",
    ">Documents required by the applicable compliance rules for your business.<": ">{t('assistant.docsRequiredBy', 'Documents required by the applicable compliance rules for your business.')}<",
    "placeholder=\"Search documents in this category...\"": "placeholder={t('assistant.searchCatPlaceholder', 'Search documents in this category...')}",
    ">Clear search<": ">{t('assistant.clearSearch', 'Clear search')}<",
    " result{": " {t('assistant.resultSingular', 'result')}{",
    " results": " {t('assistant.resultsPlural', 'results')}",
    " for “": " {t('assistant.for', 'for')} “",
    ">Matched on document name, obligation and issuing authority.<": ">{t('assistant.matchedOn', 'Matched on document name, obligation and issuing authority.')}<",
    ">Business meaning<": ">{t('assistant.bizMeaning', 'Business meaning')}<",
    ">Recommended action<": ">{t('assistant.recAction', 'Recommended action')}<",
    ">Prepare document <": ">{t('assistant.prepareDoc', 'Prepare document')} <",
    ">AI explanation (OpenRouter)<": ">{t('assistant.aiExplanation', 'AI explanation (OpenRouter)')}<",
    ">Sources (SurakshaSetu)<": ">{t('assistant.sources', 'Sources (SurakshaSetu)')}<"
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

files = glob.glob('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/pages/Assistant.tsx', recursive=True)
for file in files:
    process_file(file)
