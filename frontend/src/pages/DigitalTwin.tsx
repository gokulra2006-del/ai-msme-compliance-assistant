import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Database, AlertTriangle, CheckCircle, Info, Link as LinkIcon, Briefcase, PlayCircle, Loader2, ArrowRight, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';

export default function DigitalTwin() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<any>(null);

  useEffect(() => {
    fetchDigitalTwin();
  }, [token]);

  const fetchDigitalTwin = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/business/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout pageTitle="Compliance Digital Twin">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
          <Loader2 className="spin" size={32} />
          <span style={{ marginLeft: '12px' }}>{t('dt.loading', 'Loading Digital Twin...')}</span>
        </div>
      </AppLayout>
    );
  }

  if (!data || !data.profile) {
    return (
      <AppLayout pageTitle="Compliance Digital Twin">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <h2>{t('dt.noProfile', 'No business profile configured yet.')}</h2>
          <button onClick={() => navigate('/onboarding')} className="btn btn-primary" style={{ marginTop: '16px' }}>
            Complete Business Profile
          </button>
        </div>
      </AppLayout>
    );
  }

  const { profile, evaluatedObligations } = data;

  return (
    <AppLayout pageTitle="Compliance Digital Twin">
      <div className="page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 8px 0' }}>
            <Database style={{ color: 'var(--accent-light)' }} size={28} />
            Compliance Digital Twin
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: '600px' }}>
            A real-time mapping of your physical business operations to the deterministic regulatory rules engine.
          </p>
        </div>
        <button 
          onClick={() => navigate('/what-if-simulator')}
          className="btn"
          style={{ background: '#7e22ce', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <PlayCircle size={18} />
          What-If Simulator
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Left Column: Business State */}
        <div style={{ flex: '1 1 300px' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={20} style={{ color: 'var(--accent-light)' }} />
              <h3 className="card-title" style={{ margin: 0 }}>{t('dt.liveAttr', 'Live Business Attributes')}</h3>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.name', 'Name')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.companyName || 'Not set'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.stateDistrict', 'State / District')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.state || '-'} / {profile.district || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.industry', 'Industry')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.industry || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.totalWorkers', 'Total Workers')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.totalWorkers || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.contractWorkers', 'Contract Workers')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.contractWorkers || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.nightShifts', 'Night Shifts')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.nightShift ? 'Yes' : 'No'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.boiler', 'Boiler')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.boiler ? 'Yes' : 'No'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('dt.effluent', 'Effluent Discharge')}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{profile.effluent ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Rule Traceability */}
        <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <LinkIcon size={20} style={{ color: 'var(--accent-light)' }} /> 
                Applicable Obligations Traceability
              </h2>
            </div>
            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', marginTop: 0 }}>
                Below are the obligations deterministically matched to your business profile. Click "Why?" to trace the exact condition.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {evaluatedObligations?.map((rule: any, idx: number) => (
                  <div key={idx} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '15px' }}>{rule.obligationTitle}</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>{t('dt.source', 'Source:')} {rule.regulatorySource?.actName || t('dt.unknownAct', 'Unknown Act')}</span>
                        <span className={`badge ${rule.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>
                          {rule.severity}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedRule(rule)}
                      className="btn btn-outline btn-sm"
                    >
                      Why does this apply?
                    </button>
                  </div>
                ))}

                {(!evaluatedObligations || evaluatedObligations.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No applicable obligations found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning Modal */}
      {selectedRule && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} className="fade-in">
          <div className="card" style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', padding: '24px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{t('dt.reasoningChain', 'Reasoning Chain')}</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>{selectedRule.obligationTitle}</p>
              </div>
              <button onClick={() => setSelectedRule(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <XCircle size={24} />
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <Info size={20} style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.5 }}>
                  {selectedRule.explanation}
                </p>
              </div>

              <h4 style={{ fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.05em', marginBottom: '16px' }}>{t('dt.evalTrace', 'Evaluation Trace')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                
                {/* 1. Profile Attribute */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 'bold' }}>
                    1
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', flex: 1 }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>{t('dt.businessProfile', 'Business Profile')}</span>
                    {selectedRule.conditionsMatched?.map((cond: any, i: number) => (
                      <div key={i} style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        <span style={{ fontWeight: 600 }}>{cond.readableField}</span> = {String(cond.actualValue)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Condition Matched */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 'bold' }}>
                    2
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', flex: 1 }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>{t('dt.ruleCondition', 'Rule Condition')}</span>
                    {selectedRule.conditionsMatched?.map((cond: any, i: number) => (
                      <div key={i} style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {t('dt.required', 'Required:')} <span style={{ fontWeight: 600 }}>{cond.readableField} {cond.operator} {String(cond.expectedValue)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Result */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle size={16} />
                  </div>
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)', flex: 1 }}>
                    <span style={{ fontSize: '12px', color: 'var(--success)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>{t('dt.outcome', 'Outcome')}</span>
                    <div style={{ fontSize: '14px', color: 'var(--success)', fontWeight: 'bold' }}>{t('dt.ruleTriggered', 'Rule Triggered: APPLIES')}</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AppLayout>
  );
}
