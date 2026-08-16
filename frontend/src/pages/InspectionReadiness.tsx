import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, CheckCircle, Clock, ShieldAlert, FileSearch, Loader2, Printer, Edit, User, Activity, Bookmark, Eye } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { useLanguage } from '../context/LanguageContext';

const InspectionReadiness = () => {
  const { token, loading: authLoading } = useContext(AuthContext);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [simMode, setSimMode] = useState(false);
  const [deptView, setDeptView] = useState('ALL');

  useEffect(() => {
    if (authLoading) return;
    if (!token) { navigate('/login'); return; }

    const fetchReadiness = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/inspection/readiness', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data.data);
      } catch (err: any) {
        if (err.response?.status === 401) navigate('/login');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReadiness();
  }, [token, authLoading, navigate]);

  const handleGeneratePack = async () => {
    setGenerating(true);
    try {
      await axios.post('http://localhost:5000/api/inspection/generate-pack', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.open('/inspection-pack', '_blank');
    } catch (err) {
      console.error('Failed to log pack generation');
      alert('Failed to generate pack');
    } finally {
      setGenerating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'READY': return 'var(--success)';
      case 'MOSTLY_READY': return 'var(--accent-light)';
      case 'NEEDS_ATTENTION': return 'var(--warning)';
      case 'HIGH_RISK': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout pageTitle={t('topbar.inspection_readiness', 'Inspection Readiness')}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
          <Loader2 className="spin" size={32} />
          <span style={{ marginLeft: 12 }}>Analyzing compliance data against GAWK ruleset...</span>
        </div>
      </AppLayout>
    );
  }

  if (!data || data.readinessStatus === 'INSUFFICIENT_DATA') {
    return (
      <AppLayout pageTitle={t('topbar.inspection_readiness', 'Inspection Readiness')}>
        <div className="card mb-24" style={{ borderColor: 'var(--warning)', textAlign: 'center', padding: '48px' }}>
          <AlertTriangle size={48} color="var(--warning)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ marginBottom: 12 }}>Insufficient Data</h2>
          <p style={{ color: 'var(--text-secondary)' }}>We don't have enough compliance action data to calculate inspection readiness yet. Please complete your business profile and ensure the Rules Engine has run.</p>
          <button className="btn btn-accent mt-16" onClick={() => navigate('/onboarding')}>Go to Business Profile</button>
        </div>
      </AppLayout>
    );
  }

  // Derive unverified evidence
  const unverifiedEvidence = data.evidenceIndex?.filter((ev: any) => ev.verificationStatus === 'UNVERIFIED' || ev.verificationStatus === 'UNDER_REVIEW') || [];
  
  // Domains for grouping
  const domains = ['ALL', ...Array.from<string>(new Set(data.checklist?.map((c:any) => c.domain).filter(Boolean)))];

  const filteredChecklist = data.checklist?.filter((c:any) => deptView === 'ALL' || c.domain === deptView);
  const filteredMissing = data.missingDocuments?.filter((d:any) => deptView === 'ALL' || d.domain === deptView);

  return (
    <AppLayout pageTitle={t('topbar.inspection_readiness', 'Inspection Readiness')}>
      
      {simMode && (
        <div style={{ padding: '16px', background: 'var(--accent)', color: '#fff', borderRadius: '8px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={20} /> Simulated Inspection Readiness Assessment</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>This mode presents your live compliance data as inspection-style checkpoints. This is not an actual government inspection.</p>
          </div>
          <button className="btn btn-outline" style={{ background: 'rgba(0,0,0,0.2)', color: '#fff', border: 'none' }} onClick={() => setSimMode(false)}>Exit Simulation</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {t('inspection_readiness') || "Inspection Readiness"}
            <span style={{ 
              color: getStatusColor(data.readinessStatus), 
              padding: '4px 12px', 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: '8px', 
              fontSize: '1.2rem',
              fontWeight: 700
            }}>
              {data.readinessStatus.replace('_', ' ')}
            </span>
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Deterministically calculated from your live compliance data using GAWK.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {!simMode && (
            <button className="btn btn-outline" onClick={() => setSimMode(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} /> Simulate Inspection
            </button>
          )}
          <button 
            className="btn btn-accent" 
            onClick={handleGeneratePack} 
            disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {generating ? <Loader2 className="spin" size={18} /> : <Printer size={18} />}
            {t('inspection_pack') || "Generate Inspection Pack"}
          </button>
        </div>
      </div>

      <div className="metrics-row mb-24">
        <div className="card metric-card" style={{ flex: '1.5' }}>
          <div className="card-title">OVERALL INSPECTION READINESS</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div className="metric-value" style={{ color: getStatusColor(data.readinessStatus), fontSize: '3rem' }}>{data.readinessScore}%</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>100% Base Score</div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Why is my score this {data.readinessScore < 70 ? 'low' : 'high'}?</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Missing/Expired Critical:</span>
              <span style={{ color: 'var(--danger)' }}>-10% each</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Missing/Expired High:</span>
              <span style={{ color: 'var(--warning)' }}>-5% each</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Overdue Actions:</span>
              <span style={{ color: 'var(--danger)' }}>-5% each</span>
            </div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-title">Missing Evidence</div>
          <div className="metric-value" style={{ color: data.missingDocuments?.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {data.missingDocuments?.length || 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Required for compliance
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-title">Unverified / Open Actions</div>
          <div className="metric-value" style={{ color: (unverifiedEvidence.length + data.metrics.overdueCount) > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {unverifiedEvidence.length + data.metrics.overdueCount}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Requires immediate review
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {data.criticalGaps && data.criticalGaps.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                <ShieldAlert size={20} /> Inspection Priority Queue
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {data.criticalGaps.map((gap: any, i: number) => (
                  <div key={i} style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '1.1rem' }}>{gap.issue}</div>
                      <span className="badge badge-red">{gap.severity} PRIORITY</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.9rem', marginBottom: '16px' }}>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>OBLIGATION:</div>
                      <div>{gap.obligation}</div>
                      
                      {gap.whatIsTheIssue && (
                        <>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>THE ISSUE:</div>
                          <div>{gap.whatIsTheIssue}</div>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>WHY IT MATTERS:</div>
                          <div style={{ color: 'var(--danger)' }}>{gap.whyDoesItMatter}</div>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>MISSING:</div>
                          <div>{gap.whatIsMissing}</div>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>ACTION:</div>
                          <div style={{ fontWeight: 500 }}>{gap.whatShouldIDo}</div>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>WHO & WHEN:</div>
                          <div>{gap.whoShouldDoIt} | {gap.whenShouldItBeDone}</div>
                          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>SOURCE:</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{gap.source}</div>
                        </>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {gap.type?.includes('EVIDENCE') ? (
                        <button className="btn btn-sm btn-outline" onClick={() => navigate('/evidence')}>Upload Evidence</button>
                      ) : (
                        <button className="btn btn-sm btn-outline" onClick={() => navigate('/calendar')}>View Action</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSearch size={20} /> Missing Documents Checklist
            </h2>
            
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Department View:</span>
              <select className="input" value={deptView} onChange={(e) => setDeptView(e.target.value)} style={{ padding: '4px 8px', width: 'auto' }}>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredMissing && filteredMissing.length === 0 ? (
                <div className="empty-state">No missing required documents in this department!</div>
              ) : (
                filteredMissing?.map((doc: any, i: number) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '16px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--danger)' }}>{doc.documentType}</div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '4px' }}><strong>Obligation:</strong> {doc.obligationTitle} ({doc.obligationCode})</div>
                      </div>
                      <span className={`badge ${doc.severity === 'CRITICAL' ? 'badge-red' : doc.severity === 'HIGH' ? 'badge-amber' : 'badge-default'}`}>
                        {doc.severity}
                      </span>
                    </div>
                    
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px', fontSize: '0.85rem' }}>WHY IS IT REQUIRED?</div>
                      <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>{doc.whyRequired}</div>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px', fontSize: '0.85rem' }}>SOURCE</div>
                      <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {doc.regulatorySource ? `${doc.regulatorySource.actName} Sec ${doc.regulatorySource.section}` : 'GAWK Ruleset'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14}/> Responsible: {doc.assignedTo ? doc.assignedTo.name : 'Unassigned'}
                      </div>
                      <button 
                        className="btn btn-sm btn-accent" 
                        onClick={() => navigate(`/document-preparation/${doc.obligationCode}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Edit size={16} /> Prepare Draft
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={20} /> Evidence Requiring Review
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {unverifiedEvidence.length === 0 ? (
                <div className="empty-state">No evidence requires human verification currently.</div>
              ) : (
                unverifiedEvidence.map((ev: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--warning)', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.05)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{ev.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({ev.type})</span></div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Uploaded by {ev.responsibleUser} • {new Date(ev.uploadDate).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Obligation: {ev.obligationCode}</div>
                    </div>
                    <button className="btn btn-sm btn-outline" onClick={() => navigate('/evidence')}>Review Evidence</button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} /> Department-Wise Compliance Status
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Obligation</th>
                    <th>Severity</th>
                    <th>Submission Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChecklist && filteredChecklist.map((item: any, i: number) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.obligationName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.ruleCode}</div>
                      </td>
                      <td>
                        <span className={`badge ${item.severity === 'CRITICAL' ? 'badge-red' : item.severity === 'HIGH' ? 'badge-amber' : 'badge-default'}`}>
                          {item.severity}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          <span className={`badge ${item.submissionStatus === 'COMPLETED' ? 'badge-green' : item.submissionStatus === 'NOT_STARTED' ? 'badge-default' : 'badge-amber'}`}>
                            {item.submissionStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!filteredChecklist || filteredChecklist.length === 0) && (
                    <tr><td colSpan={3} style={{ textAlign: 'center' }}>No obligations in this department.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card" style={{ background: 'var(--background-alt)' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} /> Before Inspection Checklist
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.readinessScore > 90} readOnly />
                <span style={{ fontSize: '0.9rem', color: data.readinessScore > 90 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Readiness score &gt; 90%</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.metrics.missingCount === 0} readOnly />
                <span style={{ fontSize: '0.9rem', color: data.metrics.missingCount === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>All Required evidence available</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.metrics.expiredCount === 0} readOnly />
                <span style={{ fontSize: '0.9rem', color: data.metrics.expiredCount === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Expired evidence identified & replaced</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={unverifiedEvidence.length === 0} readOnly />
                <span style={{ fontSize: '0.9rem', color: unverifiedEvidence.length === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Unverified evidence reviewed by human</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.metrics.overdueCount === 0} readOnly />
                <span style={{ fontSize: '0.9rem', color: data.metrics.overdueCount === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>Open corrective actions reviewed</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.criticalGaps?.length === 0} readOnly />
                <span style={{ fontSize: '0.9rem', color: data.criticalGaps?.length === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>High-risk issues addressed</span>
              </label>
            </div>
            <button className="btn btn-outline" style={{ width: '100%', marginTop: '16px' }} onClick={handleGeneratePack}>
              Generate Inspection Pack
            </button>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} /> Open Corrective Actions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.overdueActions?.length === 0 ? (
                <div className="empty-state">No unresolved corrective actions.</div>
              ) : (
                data.overdueActions?.map((action: any, i: number) => (
                  <div key={`od-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{action.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Due: {new Date(action.deadline).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><User size={10}/> {action.responsibleUser}</div>
                    </div>
                    <button className="btn btn-sm btn-outline" onClick={() => navigate('/calendar')}>View</button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} /> Expired Evidence Checklist
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.expiringEvidence && data.expiringEvidence.length > 0 ? (
                data.expiringEvidence.map((ev: any, i: number) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', paddingBottom: '12px', borderBottom: i < data.expiringEvidence.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{ev.documentName}</div>
                      <span className={`badge ${ev.status === 'EXPIRED' ? 'badge-red' : 'badge-amber'}`}>{ev.status.replace('_', ' ')}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Obligation: {ev.obligationTitle}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '4px' }}>Risk: {ev.risk}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Action: {ev.recommendedAction}</div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No expired evidence.</div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bookmark size={18} /> Recent Regulatory Changes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.recentUpdates && data.recentUpdates.length > 0 ? (
                data.recentUpdates.map((update: any, i: number) => (
                  <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{update.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Effective: {update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString() : 'N/A'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Source: {update.sourceId?.name || 'Government Gazette'}</div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No verified relevant regulatory changes available.</div>
              )}
            </div>
          </div>

        </div>
      </div>
      
    </AppLayout>
  );
};

export default InspectionReadiness;
