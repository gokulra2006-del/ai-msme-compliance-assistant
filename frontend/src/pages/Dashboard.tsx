import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import AppLayout from '../components/AppLayout';

const Dashboard = () => {
  const { token, user, loading: authLoading, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setShowRiskBreakdown] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { navigate('/login'); return; }

    const fetch = async () => {
      try {
        if (user?.role === 'ADMIN') {
          const res = await axios.get('http://localhost:5000/api/business/admin/metrics', { headers: { Authorization: `Bearer ${token}` } });
          setAdminData(res.data.data);
        } else {
          const [oblRes, evRes, calRes, riskRes, historyRes, activityRes, alertsRes] = await Promise.all([
            axios.get('http://localhost:5000/api/obligations/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('http://localhost:5000/api/evidence/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('http://localhost:5000/api/compliance-actions/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('http://localhost:5000/api/risk/score', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: null } })),
            axios.get('http://localhost:5000/api/risk/history', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } })),
            axios.get('http://localhost:5000/api/business/activity', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } })),
            axios.get('http://localhost:5000/api/notifications/alerts-summary', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: null } }))
          ]);
          setData({ 
            ...oblRes.data.data, 
            evidence: evRes.data.data, 
            calendar: calRes.data.data,
            history: historyRes.data.data || [],
            activity: activityRes.data.data || [],
            alerts: alertsRes.data.data || null
          });
          setRiskData(riskRes.data.data);
        }
      } catch (err: any) {
        if (err.response?.status === 401) { logout(); navigate('/login'); }
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token, authLoading, logout, navigate]);

  if (authLoading || loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>{t('loading', 'Loading...')}</div>;
  }

  if (!token) return null;

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case 'CRITICAL': return <span className="badge badge-red">{t(`risk.${s}`)}</span>;
      case 'HIGH': return <span className="badge badge-amber">{t(`risk.${s}`)}</span>;
      case 'MEDIUM': return <span className="badge badge-blue">{t('risk.MODERATE')}</span>;
      case 'LOW': return <span className="badge badge-green">{t(`risk.${s}`)}</span>;
      default: return <span className="badge badge-muted">{s}</span>;
    }
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'badge-red';
      case 'HIGH': return 'badge-amber';
      case 'MODERATE': return 'badge-blue';
      case 'LOW': return 'badge-green';
      default: return 'badge-muted';
    }
  };

  const formatFieldName = (field: string) => {
    const names: Record<string, string> = {
      totalWorkers: 'Total Workers',
      contractWorkers: 'Contract Workers',
      gstin_or_turnover: 'GSTIN / Turnover',
      state: 'State',
      district: 'District',
      industry: 'Industry',
      subIndustry: 'Sub-industry',
      boiler: 'Boiler',
      coldStorage: 'Cold Storage',
      effluent: 'Effluent Discharge',
      solidWaste: 'Solid Waste',
      hazardousWaste: 'Hazardous Waste',
      plasticPackaging: 'Plastic Packaging',
      packagedRetail: 'Packaged Retail'
    };
    return names[field] || field;
  };

  // Derive Critical Issues
  const criticalIssues: any[] = [];
  if (data?.calendar?.upcoming) {
    data.calendar.upcoming.forEach((act: any) => {
      if (act.status === 'OVERDUE') criticalIssues.push({ title: act.title, type: 'Compliance Action', priority: act.priority, status: t('status.OVERDUE'), link: '/calendar' });
    });
  }
  if (data?.evidence?.requiredDocuments) {
    data.evidence.requiredDocuments.forEach((doc: any) => {
      if (doc.status === 'EXPIRED') criticalIssues.push({ title: doc.documentType, type: 'Evidence Document', priority: 'CRITICAL', status: t('status.EXPIRED'), link: '/evidence' });
      if (doc.verificationStatus === 'REJECTED') criticalIssues.push({ title: doc.documentType, type: 'Evidence Document', priority: 'HIGH', status: t('status.REJECTED'), link: '/evidence' });
    });
  }
  if (data?.applicableObligations) {
    data.applicableObligations.forEach((obl: any) => {
      if (obl.severity === 'CRITICAL') criticalIssues.push({ title: obl.title, type: 'Obligation', priority: 'CRITICAL', status: t('status.APPLIES'), link: '/obligations' });
    });
  }
  const topCriticalIssues = criticalIssues.slice(0, 5);

  const missingEvidences = data?.evidence?.requiredDocuments?.filter((d: any) => ['MISSING', 'EXPIRED', 'EXPIRING_SOON', 'REJECTED'].includes(d.status) || d.verificationStatus === 'REJECTED') || [];

  return (
    <AppLayout pageTitle={t('topbar.commandCenter')} userData={data}>
      {user?.role === 'ADMIN' ? (
        <div>
              <div className="metrics-row mb-24">
                <div className="card metric-card">
                  <div className="card-title micro">Total Users</div>
                  <div className="metric-value">{adminData?.totalUsers || 0}</div>
                </div>
                <div className="card metric-card">
                  <div className="card-title micro">Active Businesses</div>
                  <div className="metric-value">{adminData?.activeBusinesses || 0}</div>
                </div>
                <div className="card metric-card">
                  <div className="card-title micro">Active Rule Packs</div>
                  <div className="metric-value">{adminData?.totalRules || 0}</div>
                </div>
              </div>
              
              <div className="card">
                <h2 className="card-title">Recent System Activity</h2>
                {adminData?.recentActivity && adminData.recentActivity.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {adminData.recentActivity.map((log: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-light)', marginTop: '6px' }} />
                        <div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>{log.action.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Actor: {log.user?.name || 'SYSTEM'} ({log.user?.role || 'SYSTEM'})</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '24px 0' }}>No recent activity.</div>
                )}
              </div>
            </div>
          ) : !data?.hasProfile ? (
            <div className="card" style={{ textAlign: 'center', padding: '64px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '16px' }}>No business profile configured yet</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '32px', lineHeight: 1.6 }}>
                Complete your business profile to generate applicable compliance obligations. Our deterministic rules engine requires this information to accurately assess your regulatory requirements.
              </p>
              <Link to="/onboarding" className="btn btn-accent" style={{ padding: '12px 32px', fontSize: '1rem' }}>
                Complete Business Profile
              </Link>
            </div>
          ) : (
            <>
              {/* Quick Actions Bar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {(user?.role === 'OWNER' || !user?.role) && <Link to="/onboarding" className="btn btn-outline btn-sm">{t('nav.editProfile').replace('⚙️ ', '')}</Link>}
                <Link to="/obligations" className="btn btn-outline btn-sm">{t('nav.obligations').replace('📋 ', '')}</Link>
                <Link to="/evidence" className="btn btn-outline btn-sm">{t('ui.upload')}</Link>
                <Link to="/calendar" className="btn btn-outline btn-sm">{t('ui.viewCalendar')}</Link>
                <Link to="/updates/impact" className="btn btn-outline btn-sm">View Regulatory Impacts</Link>
                <Link to="/digital-twin" className="btn btn-outline btn-sm">{t('ui.review', 'Review')}</Link>
              </div>

          {/* Compliance Alerts Section */}
          {data?.alerts && (data.alerts.overdue > 0 || data.alerts.dueToday > 0 || data.alerts.dueSoon > 0 || data.alerts.escalations > 0 || data.alerts.expiredEvidence > 0 || data.alerts.pendingReview > 0 || data.alerts.rejected > 0) && (
            <div className="card mb-24" style={{ background: 'var(--bg-elevated)', borderLeft: '4px solid var(--danger)' }}>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Compliance Alerts & Escalations
              </h2>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {data.alerts.escalations > 0 && (
                  <Link to="/calendar" className="btn btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <span style={{ fontWeight: 700 }}>{data.alerts.escalations}</span> Escalations
                  </Link>
                )}
                {data.alerts.overdue > 0 && (
                  <Link to="/calendar" className="btn btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <span style={{ fontWeight: 700 }}>{data.alerts.overdue}</span> Overdue Actions
                  </Link>
                )}
                {data.alerts.expiredEvidence > 0 && (
                  <Link to="/evidence" className="btn btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <span style={{ fontWeight: 700 }}>{data.alerts.expiredEvidence}</span> Expired Evidence
                  </Link>
                )}
                {data.alerts.rejected > 0 && (
                  <Link to="/evidence" className="btn btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <span style={{ fontWeight: 700 }}>{data.alerts.rejected}</span> Rejected Items
                  </Link>
                )}
                {data.alerts.pendingReview > 0 && (
                  <Link to="/evidence" className="btn btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
                    <span style={{ fontWeight: 700 }}>{data.alerts.pendingReview}</span> Pending Reviews
                  </Link>
                )}
                {data.alerts.dueToday > 0 && (
                  <Link to="/calendar" className="btn btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
                    <span style={{ fontWeight: 700 }}>{data.alerts.dueToday}</span> Due Today
                  </Link>
                )}
                {data.alerts.dueSoon > 0 && (
                  <Link to="/calendar" className="btn btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', borderColor: 'var(--accent-light)', color: 'var(--accent-light)', background: 'rgba(59, 130, 246, 0.05)' }}>
                    <span style={{ fontWeight: 700 }}>{data.alerts.dueSoon}</span> Due Next 7 Days
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* 1. Risk Score Card & 2. Risk Explanation & 7. Recommended Actions */}
          {(() => {
            const displayRiskData = riskData || {
              score: 0,
              riskLevel: 'LOW',
              calculatedAt: new Date().toISOString(),
              riskDrivers: [],
              recommendedActions: []
            };
            const strokeColor = displayRiskData.riskLevel === 'CRITICAL' ? 'var(--danger)' : 
                                displayRiskData.riskLevel === 'HIGH' ? 'var(--warning)' : 
                                displayRiskData.riskLevel === 'MODERATE' ? 'var(--accent-light)' : 
                                'var(--success)';
            return (
            <div className="card mb-24" style={{ 
              background: displayRiskData.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.05)' : 
                          displayRiskData.riskLevel === 'HIGH' ? 'rgba(245, 158, 11, 0.05)' : 
                          'rgba(255,255,255,0.02)',
              border: `1px solid ${
                displayRiskData.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 
                displayRiskData.riskLevel === 'HIGH' ? 'rgba(245, 158, 11, 0.2)' : 
                'var(--border)'
              }`
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
                <div style={{ textAlign: 'center', paddingRight: '24px', borderRight: '1px solid var(--border)' }}>
                  <h2 className="card-title micro" style={{ textTransform: 'uppercase' }}>{t('dash.complianceRisk')}</h2>
                  
                  <div style={{ position: 'relative', width: '140px', height: '140px', margin: '24px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                      <circle cx="50" cy="50" r="45" fill="none" stroke={strokeColor} strokeWidth="6" strokeDasharray="283" strokeDashoffset={283 - (283 * displayRiskData.score) / 100} style={{ transition: 'stroke-dashoffset 1s ease-out' }} strokeLinecap="round" transform="rotate(-90 50 50)" />
                    </svg>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, zIndex: 1, color: 'var(--text-primary)' }}>
                      {displayRiskData.score}%
                    </div>
                  </div>
                  <div className={`badge ${getRiskBadgeClass(displayRiskData.riskLevel)}`} style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
                    {t(`risk.${displayRiskData.riskLevel}`)}
                  </div>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: '24px', width: '100%' }} onClick={() => setShowRiskBreakdown(true)}>
                    {t('ui.viewBreakdown', 'View Breakdown')}
                  </button>
                  <div style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(displayRiskData.calculatedAt).toLocaleString()}
                  </div>
                </div>

                <div style={{ paddingRight: '24px', borderRight: '1px solid var(--border)' }}>
                  <h3 className="card-title micro" style={{ marginBottom: '16px', textTransform: 'uppercase' }}>Risk Drivers</h3>
                  {displayRiskData.riskDrivers && displayRiskData.riskDrivers.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {displayRiskData.riskDrivers.map((driver: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>{driver}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>0 risk drivers.</p>
                  )}
                </div>

                <div>
                  <h3 className="card-title micro" style={{ marginBottom: '16px', textTransform: 'uppercase' }}>Recommended Actions</h3>
                  {displayRiskData.recommendedActions && displayRiskData.recommendedActions.length > 0 ? (
                    <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {displayRiskData.recommendedActions.map((action: string, idx: number) => (
                        <li key={idx} style={{ marginBottom: '12px' }}>
                          <div style={{ marginBottom: '4px' }}>{action}</div>
                          <Link to="/calendar" className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>{t('ui.review')}</Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <>
                      <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>No immediate risk-reduction action identified.</p>
                      <button className="btn btn-outline btn-sm" onClick={() => setShowRiskBreakdown(true)}>{t('ui.review', 'Review')}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* 3. Key Compliance Metrics */}
          <div className="metrics-row mb-24">
            {user?.role !== 'ACCOUNTANT' && (
              <div className="card metric-card">
                <div className="card-title micro">{t('dash.applicableObligations')}</div>
                <div className="metric-value">{data?.applies || 0}</div>
              </div>
            )}
            {user?.role !== 'ACCOUNTANT' && (
              <div className="card metric-card" style={{ borderColor: data?.riskBreakdown?.critical > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)' }}>
                <div className="card-title micro">{t('dash.criticalObligations')}</div>
                <div className="metric-value" style={{ color: data?.riskBreakdown?.critical > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{data?.riskBreakdown?.critical || 0}</div>
              </div>
            )}
            <div className="card metric-card" style={{ borderColor: data?.evidence?.summary?.missing > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)' }}>
              <div className="card-title micro">{user?.role === 'ACCOUNTANT' ? 'Documents to Upload' : t('dash.missingEvidence')}</div>
              <div className="metric-value" style={{ color: data?.evidence?.summary?.missing > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{data?.evidence?.summary?.missing || 0}</div>
            </div>
            {user?.role !== 'ACCOUNTANT' && (
              <div className="card metric-card">
                <div className="card-title micro">{t('dash.expiringEvidence')}</div>
                <div className="metric-value">{data?.evidence?.summary?.expiringSoon || 0}</div>
              </div>
            )}
            <div className="card metric-card" style={{ borderColor: data?.calendar?.overdue > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)' }}>
              <div className="card-title micro">{user?.role === 'ACCOUNTANT' ? 'My Overdue Tasks' : t('dash.overdueActions')}</div>
              <div className="metric-value" style={{ color: data?.calendar?.overdue > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{data?.calendar?.overdue || 0}</div>
            </div>
            <div className="card metric-card">
              <div className="card-title micro">{user?.role === 'ACCOUNTANT' ? 'My Due Soon' : t('dash.dueSoon')}</div>
              <div className="metric-value">{data?.calendar?.dueSoon || 0}</div>
            </div>
            <div className="card metric-card" style={{ borderColor: data?.calendar?.completed > 0 ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)' }}>
              <div className="card-title micro">{t('dash.completedActions')}</div>
              <div className="metric-value" style={{ color: 'var(--success)' }}>{data?.calendar?.completed || 0}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* 4. Critical Issues */}
            <div className="card" style={{ border: topCriticalIssues.length > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border)' }}>
              <h2 className="card-title" style={{ color: topCriticalIssues.length > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{t('dash.requiresAttention')}</h2>
              {topCriticalIssues.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topCriticalIssues.map((issue: any, i: number) => (
                    <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid var(--danger)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{issue.title}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--danger)' }}>{issue.status}</span> • {t(`risk.${issue.priority}`) || issue.priority}
                      </div>
                      <Link to={issue.link} className="btn btn-outline btn-sm">{t('ui.review')}</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>{t('empty.noIssues')}</div>
              )}
            </div>

            {/* 5. Upcoming Deadlines */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="card-title" style={{ margin: 0 }}>{t('dash.upcomingCompliance')}</h2>
                <Link to="/calendar" className="btn btn-outline btn-sm">{t('ui.viewCalendar')}</Link>
              </div>
              {data?.calendar?.upcoming && data.calendar.upcoming.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.calendar.upcoming.map((action: any, i: number) => {
                    const daysRemaining = action.dueDate ? Math.ceil((new Date(action.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null;
                    return (
                      <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: action.status === 'OVERDUE' ? '3px solid var(--danger)' : '3px solid var(--accent-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{action.title}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{action.ruleCode}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {action.dueDate ? `In ${daysRemaining} days` : `Frequency: ${action.frequency}`}
                            </div>
                            {action._id && (
                              <Link to={`/submissions/${action._id}`} className="btn btn-primary btn-sm" style={{ marginTop: '12px', padding: '4px 12px', fontSize: '0.8rem' }}>View Submission</Link>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            {getSeverityBadge(action.priority)}
                            <span style={{ fontSize: '0.75rem', color: action.status === 'OVERDUE' ? 'var(--danger)' : 'var(--text-muted)' }}>{t(`status.${action.status}`) || action.status}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>{t('empty.noDeadlines')}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* 6. Evidence Gaps */}
            <div className="card">
              <h2 className="card-title">{t('dash.evidenceGaps')}</h2>
              {missingEvidences.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {missingEvidences.slice(0, 5).map((doc: any, i: number) => (
                    <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid var(--warning)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{doc.documentType}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Status: <span style={{ color: doc.status === 'MISSING' ? 'var(--danger)' : 'var(--warning)' }}>{t(`status.${doc.status}`) || doc.status}</span>
                      </div>
                      <Link to="/evidence" className="btn btn-outline btn-sm">{doc.status === 'MISSING' ? t('ui.upload') : t('ui.review')}</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>{t('empty.noGaps')}</div>
              )}
            </div>

            {/* 8. Compliance Progress */}
            <div className="card">
              <h2 className="card-title">{t('dash.complianceProgress')}</h2>
              {data?.calendar?.totalApplicable > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                      {data.calendar.completed} / {data.calendar.totalApplicable} actions completed
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-light)' }}>
                      {Math.round((data.calendar.completed / data.calendar.totalApplicable) * 100)}%
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '12px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden', display: 'flex', marginBottom: '24px' }}>
                    <div style={{ width: `${(data.calendar.completed / data.calendar.totalApplicable) * 100}%`, background: 'var(--success)', height: '100%' }} />
                    <div style={{ width: `${(data.calendar.overdue / data.calendar.totalApplicable) * 100}%`, background: 'var(--danger)', height: '100%' }} />
                    <div style={{ width: `${(data.calendar.pending / data.calendar.totalApplicable) * 100}%`, background: 'var(--warning)', height: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t('status.COMPLETED')}</span>
                      <span style={{ fontWeight: 600, color: 'var(--success)' }}>{data.calendar.completed}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t('status.PENDING')}</span>
                      <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{data.calendar.pending}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t('status.OVERDUE')}</span>
                      <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{data.calendar.overdue}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>No applicable compliance actions available yet.</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
            {/* 9. Obligation Summary */}
            <div className="card">
              <h2 className="card-title">{t('dash.obligationSummary')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('status.APPLIES')}</span>
                  <span style={{ fontWeight: 600 }}>{data?.applies || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('status.DOES_NOT_APPLY')}</span>
                  <span style={{ fontWeight: 600 }}>{data?.doesNotApply || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('status.INSUFFICIENT_DATA')}</span>
                  <span style={{ fontWeight: 600, color: data?.insufficientData > 0 ? 'var(--warning)' : 'inherit' }}>{data?.insufficientData || 0}</span>
                </div>
              </div>
              <Link to="/obligations" className="btn btn-outline btn-sm" style={{ marginTop: '16px', width: '100%' }}>{t('nav.obligations').replace('📋 ', '')}</Link>
            </div>

            {/* 11. Recent Activity */}
            <div className="card">
              <h2 className="card-title">{t('dash.recentActivity')}</h2>
              {data?.activity && data.activity.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {data.activity.slice(0, 4).map((log: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-light)', marginTop: '6px' }} />
                      <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{log.action.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>{t('empty.noActivity')}</div>
              )}
            </div>

            {/* 12. Risk Trend */}
            <div className="card">
              <h2 className="card-title">{t('dash.riskTrend')}</h2>
              {data?.history && data.history.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.history.map((hist: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(hist.calculatedAt).toLocaleDateString()}
                      </span>
                      <span style={{ fontWeight: 600, color: 
                        hist.riskLevel === 'CRITICAL' ? 'var(--danger)' : 
                        hist.riskLevel === 'HIGH' ? 'var(--warning)' : 
                        hist.riskLevel === 'MODERATE' ? 'var(--accent-light)' : 
                        'var(--success)'
                      }}>
                        {hist.score} ({t(`risk.${hist.riskLevel}`)})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '24px 0' }}>{t('empty.noTrend')}</div>
              )}
            </div>
          </div>
          </>
        )}
    </AppLayout>
  );
};

export default Dashboard;
