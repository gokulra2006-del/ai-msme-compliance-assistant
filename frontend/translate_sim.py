import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    replacements = {
        ">Loading profile...<": ">{t('sim.loadingProfile', 'Loading profile...')}<",
        ">No business profile found<": ">{t('sim.noProfile', 'No business profile found')}<",
        ">The simulator needs an existing business profile before it can calculate compliance impact.<": ">{t('sim.noProfileDesc', 'The simulator needs an existing business profile before it can calculate compliance impact.')}<",
        ">What-If Compliance Simulator<": ">{t('sim.title', 'What-If Compliance Simulator')}<",
        ">Preview the deterministic compliance impact of a potential business change WITHOUT modifying your actual records.<": ">{t('sim.subtitle', 'Preview the deterministic compliance impact of a potential business change WITHOUT modifying your actual records.')}<",
        ">Run Simulation<": ">{t('sim.runSim', 'Run Simulation')}<",
        ">History<": ">{t('sim.history', 'History')}<",
        ">1. Select a Scenario<": ">{t('sim.scenarioSelect', '1. Select a Scenario')}<",
        "'Hire 20 Employees'": "t('sim.hire20', 'Hire 20 Employees')",
        "'Install Boiler'": "t('sim.installBoiler', 'Install Boiler')",
        "'Start Night Shift'": "t('sim.nightShift', 'Start Night Shift')",
        "'Start Exporting'": "t('sim.exporting', 'Start Exporting')",
        ">2. Or Edit Variables Manually<": ">{t('sim.editManual', '2. Or Edit Variables Manually')}<",
        ">Total Employees<": ">{t('sim.totalEmp', 'Total Employees')}<",
        ">State<": ">{t('sim.state', 'State')}<",
        ">Maharashtra<": ">{t('sim.stateMH', 'Maharashtra')}<",
        ">Tamil Nadu<": ">{t('sim.stateTN', 'Tamil Nadu')}<",
        ">Karnataka<": ">{t('sim.stateKA', 'Karnataka')}<",
        ">Gujarat<": ">{t('sim.stateGJ', 'Gujarat')}<",
        ">Haryana<": ">{t('sim.stateHR', 'Haryana')}<",
        "value=\"Maharashtra\"": "value={t('sim.stateMH', 'Maharashtra')}",
        "value=\"Tamil Nadu\"": "value={t('sim.stateTN', 'Tamil Nadu')}",
        "value=\"Karnataka\"": "value={t('sim.stateKA', 'Karnataka')}",
        "value=\"Gujarat\"": "value={t('sim.stateGJ', 'Gujarat')}",
        "value=\"Haryana\"": "value={t('sim.stateHR', 'Haryana')}",
        ">Industry<": ">{t('sim.industry', 'Industry')}<",
        ">Manufacturing<": ">{t('sim.indMfg', 'Manufacturing')}<",
        ">IT/Software<": ">{t('sim.indIT', 'IT/Software')}<",
        ">Food Processing<": ">{t('sim.indFood', 'Food Processing')}<",
        ">Pharmaceutical<": ">{t('sim.indPharma', 'Pharmaceutical')}<",
        "value=\"Manufacturing\"": "value={t('sim.indMfg', 'Manufacturing')}",
        "value=\"IT/Software\"": "value={t('sim.indIT', 'IT/Software')}",
        "value=\"Food Processing\"": "value={t('sim.indFood', 'Food Processing')}",
        "value=\"Pharmaceutical\"": "value={t('sim.indPharma', 'Pharmaceutical')}",
        "{loading ? <Loader2 size={20} className=\"spin\" /> : 'Run Deterministic Simulation'}": "{loading ? <Loader2 size={20} className=\"spin\" /> : t('sim.runBtn', 'Run Deterministic Simulation')}",
        ">Business Change<": ">{t('sim.bizChange', 'Business Change')}<",
        ">CURRENT STATE versus SIMULATED STATE<": ">{t('sim.curVsSim', 'CURRENT STATE versus SIMULATED STATE')}<",
        ">No changes selected yet.<": ">{t('sim.noChangesSelected', 'No changes selected yet.')}<",
        ">Clear Changes<": ">{t('sim.clearChanges', 'Clear Changes')}<",
        ">Simulated Result<": ">{t('sim.simResult', 'Simulated Result')}<",
        "Current Risk Delta:": "{t('sim.riskDelta', 'Current Risk Delta:')}",
        "Points": "{t('sim.points', 'Points')}",
        ">Discard<": ">{t('sim.discard', 'Discard')}<",
        ">Apply Real Changes<": ">{t('sim.applyChanges', 'Apply Real Changes')}<",
        ">What-If Summary<": ">{t('sim.summary', 'What-If Summary')}<",
        ">New Obligations<": ">{t('sim.newObligations', 'New Obligations')}<",
        ">Removed Obligations<": ">{t('sim.removedObligations', 'Removed Obligations')}<",
        ">Evidence Impact<": ">{t('sim.evidenceImpact', 'Evidence Impact')}<",
        ">Simulated Calendar<": ">{t('sim.simCalendar', 'Simulated Calendar')}<",
        ">NOT ACTIVE<": ">{t('sim.notActive', 'NOT ACTIVE')}<",
        ">No new compliance requirements triggered.<": ">{t('sim.noNewRequirements', 'No new compliance requirements triggered.')}<",
        "Source:": "{t('sim.source', 'Source:')}",
        "Freq:": "{t('sim.freq', 'Freq:')}",
        ">No existing obligations removed.<": ">{t('sim.noExistingRemoved', 'No existing obligations removed.')}<",
        ">Ask AI About This Simulation<": ">{t('sim.askAI', 'Ask AI About This Simulation')}<",
        ">The AI is fully grounded in the Suraksha Rules engine and the deterministic results above. Ask it to explain the changes, why specific rules triggered, or what documents you need.<": ">{t('sim.aiDesc', 'The AI is fully grounded in the Suraksha Rules engine and the deterministic results above. Ask it to explain the changes, why specific rules triggered, or what documents you need.')}<",
        "Analyzing...": "{t('sim.analyzing', 'Analyzing...')}",
        ">No AI explanation requested yet.<": ">{t('sim.noAIExplanation', 'No AI explanation requested yet.')}<",
        "placeholder=\"E.g., Why did risk increase by 15 points?\"": "placeholder={t('sim.aiPlaceholder', 'E.g., Why did risk increase by 15 points?')}",
        ">Ask AI<": ">{t('sim.askAIBtn', 'Ask AI')}<",
        ">No simulation history found.<": ">{t('sim.noHistory', 'No simulation history found.')}<",
        "' new obligations'": "t('sim.newObligationsText', ' new obligations')",
        "'Risk '": "t('sim.riskText', 'Risk ')"
    }

    changed = False
    for k, v in replacements.items():
        if k in content:
            content = content.replace(k, v)
            changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

process_file('c:/Users/gokul/Documents/ai-msme-compliance-assistant-main/frontend/src/pages/WhatIfSimulator.tsx')
