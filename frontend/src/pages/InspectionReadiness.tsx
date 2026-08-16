import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, CheckCircle, Clock, ShieldAlert, FileSearch, Loader2, Printer } from 'lucide-react';
import AppLayout from '../components/AppLayout';

const InspectionReadiness = () => {
  const { token, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
      // Navigate to the printable view route, opening in a new tab
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
      <AppLayout pageTitle="Inspection Readiness">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
          <Loader2 className="spin" size={32} />
          <span style={{ marginLeft: 12 }}>Analyzing compliance data...</span>
        </div>
      </AppLayout>
    );
  }

  if (!data || data.readinessStatus === 'INSUFFICIENT_DATA') {
    return (
      <AppLayout pageTitle="Inspection Readiness">
        <div className="card mb-24" style={{ borderColor: 'var(--warning)', textAlign: 'center', padding: '48px' }}>
          <AlertTriangle size={48} color="var(--warning)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ marginBottom: 12 }}>Insufficient Data</h2>
          <p style={{ color: 'var(--text-secondary)' }}>We don't have enough compliance action data to calculate inspection readiness yet. Please complete your business profile and ensure the Rules Engine has run.</p>
          <button className="btn btn-accent mt-16" onClick={() => navigate('/onboarding')}>Go to Business Profile</button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Inspection Readiness">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            Readiness Status: 
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
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Deterministically calculated from your live compliance data.</p>
        </div>
        
        <button 
          className="btn btn-outline" 
          onClick={handleGeneratePack} 
          disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {generating ? <Loader2 className="spin" size={18} /> : <Printer size={18} />}
          Generate Inspection Pack
        </button>
      </div>

      <div className="metrics-row mb-24">
        <div className="card metric-card" style={{ flex: '1.5' }}>
          <div className="card-title">Overall Score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div className="metric-value" style={{ color: getStatusColor(data.readinessStatus), fontSize: '3rem' }}>{data.readinessScore}%</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>100% Base Score</div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
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
          <div className="card-title">Required Evidence</div>
          <div className="metric-value">{data.metrics.totalRequired}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            {data.metrics.missingCount} missing, {data.metrics.expiredCount} expired
          </div>
        </div>

        <div className="card metric-card">
          <div className="card-title">Overdue Actions</div>
          <div className="metric-value" style={{ color: data.metrics.overdueCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {data.metrics.overdueCount}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Pending resolution
          </div>
        </div>
      </div>

      {data.criticalGaps.length > 0 && (
        <div className="card mb-24" style={{ borderLeft: '4px solid var(--danger)' }}>
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <ShieldAlert size={20} /> Critical Gaps
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.criticalGaps.map((gap: any, i: number) => (
              <div key={i} style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{gap.issue}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Obligation: <span style={{ color: 'var(--text-primary)' }}>{gap.obligation}</span>
                    </div>
                    {gap.docType && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Document: <span style={{ color: 'var(--text-primary)' }}>{gap.docType}</span></div>}
                  </div>
                  {gap.type.includes('EVIDENCE') ? (
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSearch size={18} /> Required Document Checklist
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.documentChecklist.length === 0 ? (
              <div className="empty-state">No specific documents strictly required by current rules.</div>
            ) : (
              data.documentChecklist.map((doc: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: i < data.documentChecklist.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{doc.documentType}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{doc.obligationTitle}</div>
                  </div>
                  <div>
                    {doc.status === 'VERIFIED' && <span className="badge badge-green"><CheckCircle size={12} style={{marginRight: 4}}/> Verified</span>}
                    {doc.status === 'MISSING' && <span className="badge badge-red">Missing</span>}
                    {doc.status === 'EXPIRED' && <span className="badge badge-red">Expired</span>}
                    {doc.status === 'PENDING' && <span className="badge badge-amber">Awaiting Review</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} /> Overdue & Upcoming Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.overdueActions.length === 0 && data.upcomingActions.length === 0 ? (
              <div className="empty-state">No pending actions.</div>
            ) : (
              <>
                {data.overdueActions.map((action: any, i: number) => (
                  <div key={`od-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{action.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Overdue: {new Date(action.dueDate).toLocaleDateString()}</div>
                    </div>
                    <button className="btn btn-sm btn-outline" onClick={() => navigate('/calendar')}>Resolve</button>
                  </div>
                ))}
                {data.upcomingActions.map((action: any, i: number) => (
                  <div key={`up-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: i < data.upcomingActions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{action.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due: {new Date(action.dueDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      
      {data.recentUpdates.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} /> Recent Regulatory Changes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.recentUpdates.map((update: any, i: number) => (
              <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{update.title}</span>
                  <span className="badge badge-accent">Verified</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{update.summary}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Effective: {update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString() : 'N/A'} | Source: {update.sourceId?.name || 'Government Gazette'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
    </AppLayout>
  );
};

export default InspectionReadiness;
