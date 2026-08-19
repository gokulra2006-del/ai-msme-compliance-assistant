import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Beaker, Briefcase, Zap, AlertTriangle, CheckCircle, Target, Factory, 
  ArrowRight, XCircle, History, LayoutGrid, MessageSquare, Loader2
} from 'lucide-react';
import AppLayout from '../components/AppLayout';



export default function WhatIfSimulator() {
  const { token } = useAuth();
  const { t } = useLanguage();

  const SCENARIOS = [
    { id: 'hire_20', title: t('sim.hire20', 'Hire 20 Employees'), icon: Briefcase, changes: { totalWorkers: 20 }, type: 'add' },
    { id: 'install_boiler', title: t('sim.installBoiler', 'Install Boiler'), icon: Factory, changes: { boiler: true }, type: 'set' },
    { id: 'night_shift', title: t('sim.nightShift', 'Start Night Shift'), icon: Zap, changes: { nightShift: true }, type: 'set' },
    { id: 'start_export', title: t('sim.exporting', 'Start Exporting'), icon: Target, changes: { exportActivity: true }, type: 'set' },
  ];
  
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [simulatedChanges, setSimulatedChanges] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'SIMULATOR' | 'HISTORY'>('SIMULATOR');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");

  useEffect(() => {
    const loadSimulatorData = async () => {
      setProfileLoading(true);
      await Promise.allSettled([fetchProfile(), fetchHistory()]);
      setProfileLoading(false);
    };

    if (token) {
      loadSimulatorData();
    } else {
      setProfileLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/business/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentProfile(res.data.data?.profile || res.data.data || null);
      return res.data.data?.profile || res.data.data || null;
    } catch (err: any) {
      console.error('Failed to load simulator profile:', err);
      setCurrentProfile(null);
      return null;
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/simulator/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data.data || []);
    } catch (err) {
      console.error(err);
      setHistory([]);
    }
  };

  const applyScenario = (scenario: any) => {
    let newChanges = { ...simulatedChanges };
    for (const [key, val] of Object.entries(scenario.changes)) {
      if (scenario.type === 'add') {
        const currentVal = currentProfile?.[key] || 0;
        newChanges[key] = currentVal + (val as number);
      } else {
        newChanges[key] = val;
      }
    }
    setSimulatedChanges(newChanges);
  };

  const handleManualChange = (field: string, value: any) => {
    setSimulatedChanges((prev: any) => ({ ...prev, [field]: value }));
  };

  const runSimulation = async () => {
    if (Object.keys(simulatedChanges).length === 0) return alert('No changes specified');
    
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/simulator/run', { simulatedChanges }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(res.data.data);
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert('Simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  const applyChangesToBusiness = async () => {
    if (!result) return;
    if (!window.confirm("WARNING: You are about to update your actual business profile based on this simulation. This will recalculate all real compliance obligations. Continue?")) return;
    
    try {
      await axios.put(`http://localhost:5000/api/simulator/${result._id}/apply`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Business profile updated successfully!');
      setResult(null);
      setSimulatedChanges({});
      fetchProfile();
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert('Failed to apply changes.');
    }
  };

  const discardSimulation = () => {
    setResult(null);
    setSimulatedChanges({});
    setAiAnswer("");
    setAiQuestion("");
  };

  const askAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim() || !result) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      const res = await axios.post('http://localhost:5000/api/assistant/chat', 
      { question: aiQuestion, simulationId: result._id }, 
      { headers: { Authorization: `Bearer ${token}` }});
      setAiAnswer(res.data.data);
    } catch (err: any) {
      setAiAnswer(err.response?.data?.error || "AI could not generate an answer.");
    } finally {
      setAiLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <AppLayout pageTitle="Simulator">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <Loader2 className="spin" size={22} />
            <span>{t('sim.loadingProfile', 'Loading profile...')}</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!currentProfile) {
    return (
      <AppLayout pageTitle="Simulator">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <h2 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>{t('sim.noProfile', 'No business profile found')}</h2>
          <p style={{ maxWidth: '520px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            The simulator needs an existing business profile before it can calculate compliance impact.
          </p>
          <button
            onClick={() => window.location.href = '/onboarding'}
            className="btn btn-primary"
            style={{ padding: '12px 20px' }}
          >
            Complete Business Profile
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Compliance Simulator">
      <div className="page fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 8px 0' }}>
          <Beaker style={{ color: 'var(--accent-light)' }} size={28} />
          What-If Compliance Simulator
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Preview the deterministic compliance impact of a potential business change WITHOUT modifying your actual records.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('SIMULATOR')}
          style={{ 
            background: 'none', border: 'none', padding: '12px 16px', 
            color: activeTab === 'SIMULATOR' ? 'var(--accent-light)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'SIMULATOR' ? '2px solid var(--accent-light)' : '2px solid transparent', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px'
          }}
        >
          <LayoutGrid size={18} /> Run Simulation
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          style={{ 
            background: 'none', border: 'none', padding: '12px 16px', 
            color: activeTab === 'HISTORY' ? 'var(--accent-light)' : 'var(--text-muted)', 
            borderBottom: activeTab === 'HISTORY' ? '2px solid var(--accent-light)' : '2px solid transparent', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px'
          }}
        >
          <History size={18} /> History
        </button>
      </div>

      {activeTab === 'SIMULATOR' && (
        !result ? (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{t('sim.scenarioSelect', '1. Select a Scenario')}</h3>
                </div>
                <div className="grid-2" style={{ gap: '16px' }}>
                  {SCENARIOS.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => applyScenario(s)}
                      style={{
                        padding: '24px', borderRadius: '8px', border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-light)'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <s.icon size={32} style={{ color: 'var(--accent-light)', marginBottom: '12px' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{t('sim.editManual', '2. Or Edit Variables Manually')}</h3>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{t('sim.totalEmp', 'Total Employees')}</label>
                    <input 
                      type="number" 
                      className="form-input"
                      value={simulatedChanges.totalWorkers !== undefined ? simulatedChanges.totalWorkers : (currentProfile.totalWorkers || 0)}
                      onChange={(e) => handleManualChange('totalWorkers', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('sim.state', 'State')}</label>
                    <select 
                      className="form-input"
                      value={simulatedChanges.state !== undefined ? simulatedChanges.state : (currentProfile.state || '')}
                      onChange={(e) => handleManualChange('state', e.target.value)}
                    >
                      <option value="MAHARASHTRA">{t('sim.stateMH', 'Maharashtra')}</option>
                      <option value="TAMIL NADU">{t('sim.stateTN', 'Tamil Nadu')}</option>
                      <option value="KARNATAKA">{t('sim.stateKA', 'Karnataka')}</option>
                      <option value="GUJARAT">{t('sim.stateGJ', 'Gujarat')}</option>
                      <option value="HARYANA">{t('sim.stateHR', 'Haryana')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('sim.industry', 'Industry')}</label>
                    <select 
                      className="form-input"
                      value={simulatedChanges.industry !== undefined ? simulatedChanges.industry : (currentProfile.industry || '')}
                      onChange={(e) => handleManualChange('industry', e.target.value)}
                    >
                      <option value="MANUFACTURING">{t('sim.indMfg', 'Manufacturing')}</option>
                      <option value="IT">{t('sim.indIT', 'IT/Software')}</option>
                      <option value="FOOD_PROCESSING">{t('sim.indFood', 'Food Processing')}</option>
                      <option value="PHARMACEUTICAL">{t('sim.indPharma', 'Pharmaceutical')}</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '12px' }}>
                    {['boiler', 'nightShift', 'effluent', 'hazardousWaste', 'plasticPackaging'].map(flag => (
                      <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <input 
                          type="checkbox" 
                          checked={simulatedChanges[flag] !== undefined ? simulatedChanges[flag] : !!currentProfile[flag]}
                          onChange={(e) => handleManualChange(flag, e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--accent-light)' }}
                        />
                        {flag.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <button
                onClick={runSimulation}
                disabled={loading || Object.keys(simulatedChanges).length === 0}
                className="btn btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {loading ? <Loader2 size={20} className="spin" /> : t('sim.runBtn', 'Run Deterministic Simulation')}
              </button>
            </div>

            <div style={{ flex: '1 1 300px' }}>
              <div className="card" style={{ position: 'sticky', top: '24px' }}>
                <div className="card-header">
                  <h3 className="card-title">{t('sim.bizChange', 'Business Change')}</h3>
                </div>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{t('sim.curVsSim', 'CURRENT STATE versus SIMULATED STATE')}</span>
                </div>
                {Object.keys(simulatedChanges).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '14px', margin: 0 }}>{t('sim.noChangesSelected', 'No changes selected yet.')}</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(simulatedChanges).map(([k, v]) => (
                      <li key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{String(currentProfile[k] || 'None')}</span>
                          <ArrowRight size={14} style={{ color: 'var(--accent-light)' }} />
                          <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{String(v)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {Object.keys(simulatedChanges).length > 0 && (
                  <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <button 
                      onClick={() => setSimulatedChanges({})}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '13px', cursor: 'pointer' }}
                    >
                      Clear Changes
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ 
                  width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: result.results.riskDelta > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  color: result.results.riskDelta > 0 ? 'var(--danger)' : 'var(--success)'
                }}>
                  {result.results.riskDelta > 0 ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{t('sim.simResult', 'Simulated Result')}</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
                    {t('sim.riskDelta', 'Current Risk Delta:')} <span style={{ fontWeight: 600, color: result.results.riskDelta > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {result.results.riskDelta > 0 ? `+${result.results.riskDelta}` : result.results.riskDelta} {t('sim.points', 'Points')}
                    </span>
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={discardSimulation} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <XCircle size={18} /> Discard
                </button>
                <button onClick={applyChangesToBusiness} className="btn" style={{ background: 'var(--danger)', color: 'white' }}>
                  Apply Real Changes
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('sim.summary', 'What-If Summary')}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('sim.newObligations', 'New Obligations')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{result.results.newRules.length}</div>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('sim.removedObligations', 'Removed Obligations')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{result.results.removedRules.length}</div>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('sim.evidenceImpact', 'Evidence Impact')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{result.results.evidenceImpact.added.length + result.results.evidenceImpact.removed.length}</div>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('sim.simCalendar', 'Simulated Calendar')}</div>
                  <div style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 'bold', marginBottom: '8px' }}>{t('sim.notActive', 'NOT ACTIVE')}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700 }}>{result.results.calendarImpact.addedEvents.length}</div>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} style={{ color: 'var(--warning)' }} /> New Obligations
                  </h3>
                </div>
                {result.results.newRules.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>{t('sim.noNewRequirements', 'No new compliance requirements triggered.')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                    {result.results.newRules.map((rule: any, i: number) => (
                      <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, color: 'var(--warning)', fontSize: '15px' }}>{rule.title}</h4>
                          <span className={`badge ${rule.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>{rule.severity}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>{rule.reason}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <span>{t('sim.source', 'Source:')} {rule.source?.actName || rule.source}</span>
                          <span>{t('sim.freq', 'Freq:')} {rule.complianceFrequency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={20} style={{ color: 'var(--success)' }} /> Removed Obligations
                  </h3>
                </div>
                {result.results.removedRules.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>{t('sim.noExistingRemoved', 'No existing obligations removed.')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                    {result.results.removedRules.map((rule: any, i: number) => (
                      <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '16px', borderRadius: '8px', opacity: 0.7 }}>
                        <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)', fontSize: '15px', textDecoration: 'line-through' }}>{rule.title}</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{rule.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={20} style={{ color: 'var(--accent-light)' }} /> Ask AI About This Simulation
                </h3>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                The AI is fully grounded in the GAWK ruleset and the deterministic results above. Ask it to explain the changes, why specific rules triggered, or what documents you need.
              </p>
              
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '16px', marginBottom: '16px', minHeight: '100px', fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {aiAnswer || (aiLoading ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}><Loader2 size={16} className="spin" /> {t('sim.analyzing', 'Analyzing...')}</span> : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('sim.noAIExplanation', 'No AI explanation requested yet.')}</span>)}
              </div>

              <form onSubmit={askAi} style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder={t('sim.aiPlaceholder', 'E.g., Why did risk increase by 15 points?')}
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                />
                <button 
                  type="submit" 
                  disabled={aiLoading || !aiQuestion.trim()}
                  className="btn btn-primary"
                >
                  Ask AI
                </button>
              </form>
            </div>
            
          </div>
        )
      )}

      {activeTab === 'HISTORY' && (
        <div className="fade-in">
          {history.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No simulation history found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {history.map((sim, i) => (
                <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{new Date(sim.createdAt).toLocaleString()} • {sim.status}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {Object.entries(sim.simulatedChanges).map(([k, v]) => (
                        <span key={k} style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-light)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{k}: {String(v)}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: sim.results.riskDelta > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      Risk {sim.results.riskDelta > 0 ? `+${sim.results.riskDelta}` : sim.results.riskDelta}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sim.results.newRules.length} new obligations</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </AppLayout>
  );
}
