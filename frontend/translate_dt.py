import os
import glob

replacements = {
    "Loading Digital Twin...": "{t('dt.loading', 'Loading Digital Twin...')}",
    ">No business profile configured yet.<": ">{t('dt.noProfile', 'No business profile configured yet.')}<",
    ">Complete Business Profile<": ">{t('dt.completeProfile', 'Complete Business Profile')}<",
    ">Compliance Digital Twin<": ">{t('dt.title', 'Compliance Digital Twin')}<",
    ">A real-time mapping of your physical business operations to the deterministic regulatory rules engine.<": ">{t('dt.subtitle', 'A real-time mapping of your physical business operations to the deterministic regulatory rules engine.')}<",
    ">What-If Simulator<": ">{t('dt.simulator', 'What-If Simulator')}<",
    ">Live Business Attributes<": ">{t('dt.liveAttr', 'Live Business Attributes')}<",
    ">Name<": ">{t('dt.name', 'Name')}<",
    ">Not set<": ">{t('dt.notSet', 'Not set')}<",
    ">State / District<": ">{t('dt.stateDistrict', 'State / District')}<",
    ">Industry<": ">{t('dt.industry', 'Industry')}<",
    ">Total Workers<": ">{t('dt.totalWorkers', 'Total Workers')}<",
    ">Contract Workers<": ">{t('dt.contractWorkers', 'Contract Workers')}<",
    ">Night Shifts<": ">{t('dt.nightShifts', 'Night Shifts')}<",
    ">Yes<": ">{t('dt.yes', 'Yes')}<",
    ">No<": ">{t('dt.no', 'No')}<",
    ">Boiler<": ">{t('dt.boiler', 'Boiler')}<",
    ">Effluent Discharge<": ">{t('dt.effluent', 'Effluent Discharge')}<",
    ">Applicable Obligations Traceability<": ">{t('dt.traceability', 'Applicable Obligations Traceability')}<",
    ">Below are the obligations deterministically matched to your business profile. Click \"Why?\" to trace the exact condition.<": ">{t('dt.traceabilityDesc', 'Below are the obligations deterministically matched to your business profile. Click \"Why?\" to trace the exact condition.')}<",
    "Source:": "{t('dt.source', 'Source:')}",
    "'Unknown Act'": "t('dt.unknownAct', 'Unknown Act')",
    ">Why does this apply?<": ">{t('dt.whyApplies', 'Why does this apply?')}<",
    ">No applicable obligations found.<": ">{t('dt.noObligations', 'No applicable obligations found.')}<",
    ">Reasoning Chain<": ">{t('dt.reasoningChain', 'Reasoning Chain')}<",
    ">Evaluation Trace<": ">{t('dt.evalTrace', 'Evaluation Trace')}<",
    ">Business Profile<": ">{t('dt.businessProfile', 'Business Profile')}<",
    ">Rule Condition<": ">{t('dt.ruleCondition', 'Rule Condition')}<",
    "Required:": "{t('dt.required', 'Required:')}",
    ">Outcome<": ">{t('dt.outcome', 'Outcome')}<",
    ">Rule Triggered: APPLIES<": ">{t('dt.ruleTriggered', 'Rule Triggered: APPLIES')}<"
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

files = glob.glob('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/pages/DigitalTwin.tsx', recursive=True)
for file in files:
    process_file(file)
