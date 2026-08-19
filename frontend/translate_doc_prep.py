import os
import glob

replacements = {
    ">Draft, manage, and prepare official documents in a few simple steps.<": ">{t('documents.dashSubtitle', 'Draft, manage, and prepare official documents in a few simple steps.')}<",
    ">My Document Dashboard<": ">{t('documents.myDash', 'My Document Dashboard')}<",
    ">Track your documents across all stages of preparation.<": ">{t('documents.trackDocs', 'Track your documents across all stages of preparation.')}<",
    "placeholder=\"Search documents...\"": "placeholder={t('documents.searchPlaceholder', 'Search documents...')}",
    ">All Status<": ">{t('documents.allStatus', 'All Status')}<",
    ">Documents Needed<": ">{t('documents.docsNeeded', 'Documents Needed')}<",
    ">Drafts In Progress<": ">{t('documents.draftsInProgress', 'Drafts In Progress')}<",
    ">Awaiting Review<": ">{t('documents.awaitingReview', 'Awaiting Review')}<",
    ">Approved<": ">{t('documents.approved', 'Approved')}<",
    "'No documents match your filters'": "t('documents.noMatchFilters', 'No documents match your filters')",
    "'No documents yet'": "t('documents.noDocsYet', 'No documents yet')",
    "'Try adjusting your search or status filter.'": "t('documents.tryAdjust', 'Try adjusting your search or status filter.')",
    "'You\\'re all set! When the Assistant identifies documents you need,\\nthey will appear here for you to prepare.'": "t('documents.allSetMsg', 'You\\'re all set! When the Assistant identifies documents you need,\\nthey will appear here for you to prepare.')",
    ">Create New Document<": ">{t('documents.createDoc', 'Create New Document')}<",
    ">Learn more about document preparation &rarr;<": ">{t('documents.learnMore', 'Learn more about document preparation &rarr;')}<",
    "<th>Status</th>": "<th>{t('documents.statusCol', 'Status')}</th>",
    "<th>Actions</th>": "<th>{t('documents.actionsCol', 'Actions')}</th>",
    ">Prepare<": ">{t('documents.prepareBtn', 'Prepare')}<"
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

files = glob.glob('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/pages/DocumentPreparation.tsx', recursive=True)
for file in files:
    process_file(file)
