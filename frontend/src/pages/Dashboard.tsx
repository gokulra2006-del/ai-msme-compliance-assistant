import { useEffect, useState, useContext } from 'react';
import type { CSSProperties } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';
import { UserRound, ClipboardList, UploadCloud, CalendarDays, FileText, ShieldCheck } from 'lucide-react';
import { DEMO_DASHBOARD, DEMO_RISK } from '../demoData';

const API = 'http://localhost:5000/api';

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
          const res = await axios.get(`${API}/business/admin/metrics`, { headers: { Authorization: `Bearer ${token}` } });
          setAdminData(res.data.data);
        } else {
          const [oblRes, evRes, calRes, riskRes, historyRes, activityRes, alertsRes] = await Promise.all([
            axios.get(`${API}/obligations/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${API}/evidence/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${API}/compliance-actions/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
            axios.get(`${API}/risk/score`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: null } })),
            axios.get(`${API}/risk/history`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } })),
            axios.get(`${API}/business/activity`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } })),
            axios.get(`${API}/notifications/alerts-summary`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: null } }))
          ]);
          // Map real API data to the dashboard state
          setData({
            hasProfile: true, 
            applies: oblRes.data?.data?.applies || 0,
            doesNotApply: oblRes.data?.data?.doesNotApply || 0,
            insufficientData: oblRes.data?.data?.insufficientData || 0,
            riskBreakdown: oblRes.data?.data?.riskBreakdown || { critical: 0, high: 0, medium: 0, low: 0 },
            applicableObligations: oblRes.data?.data?.applicableObligations || [],
            evidence: evRes.data?.data || { summary: {}, requiredDocuments: [] },
            calendar: calRes.data?.data || { totalApplicable: 0, completed: 0, pending: 0, overdue: 0, dueSoon: 0, upcoming: [] },
            alerts: alertsRes.data?.data || { overdue: 0, dueToday: 0, dueSoon: 0, escalations: 0, expiredEvidence: 0, pendingReview: 0, rejected: 0 },
            history: historyRes.data?.data || [],
            activity: activityRes.data?.data || []
          });
          setRiskData(riskRes.data?.data || null);
        }
      } catch (err: any) {
        if (err.response?.status === 401) { logout(); navigate('/login'); return; }
        console.warn('[Dashboard] API failed, using demo data as fallback.', err);
        setData(DEMO_DASHBOARD);
        setRiskData(DEMO_RISK);
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
                  <div className="card-title micro">{t("admin.totalUsers", "Total Users")}</div>
                  <div className="metric-value">{adminData?.totalUsers || 0}</div>
                </div>
                <div className="card metric-card">
                  <div className="card-title micro">{t("admin.activeBusinesses", "Active Businesses")}</div>
                  <div className="metric-value">{adminData?.activeBusinesses || 0}</div>
                </div>
                <div className="card metric-card">
                  <div className="card-title micro">{t("admin.activeRulePacks", "Active Rule Packs")}</div>
                  <div className="metric-value">{adminData?.totalRules || 0}</div>
                </div>
              </div>
              
              <div className="card">
                <h2 className="card-title">{t("admin.recentActivity", "Recent System Activity")}</h2>
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
                  <div className="empty-state" style={{ padding: '24px 0' }}>{t("admin.noRecentActivity", "No recent activity.")}</div>
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
              <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '16px' }}>{t("dash.noBusinessProfile", "No business profile configured yet")}</h2>
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
              <div className="dashboard-quick-actions">
                {(user?.role === 'OWNER' || !user?.role) && (
                  <Link to="/onboarding" className="dashboard-action-pill">
                    <UserRound size={18} />
                    <span>{t('nav.editProfile').replace('⚙️ ', '')}</span>
                  </Link>
                )}
                <Link to="/obligations" className="dashboard-action-pill">
                  <ClipboardList size={18} />
                  <span>{t('nav.obligations').replace('📋 ', '')}</span>
                </Link>
                <Link to="/evidence" className="dashboard-action-pill">
                  <UploadCloud size={18} />
                  <span>{t('ui.upload')}</span>
                </Link>
                <Link to="/calendar" className="dashboard-action-pill">
                  <CalendarDays size={18} />
                  <span>{t('ui.viewCalendar')}</span>
                </Link>
                <Link to="/updates/impact" className="dashboard-action-pill">
                  <FileText size={18} />
                  <span>{t("dash.viewRegulatoryImpacts", "View Regulatory Impacts")}</span>
                </Link>
                <Link to="/digital-twin" className="dashboard-action-pill">
                  <ShieldCheck size={18} />
                  <span>{t('ui.review', 'Review')}</span>
                </Link>
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
            <div className="dashboard-risk-shell card glass mb-8" style={{
              background: displayRiskData.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.02)' :
                          displayRiskData.riskLevel === 'HIGH' ? 'rgba(245, 158, 11, 0.02)' :
                          'var(--bg-card)',
              borderColor: displayRiskData.riskLevel === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' :
                           displayRiskData.riskLevel === 'HIGH' ? 'rgba(245, 158, 11, 0.15)' :
                           'var(--border)'
            }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                <div className="text-center md:border-r border-slate-200/50 md:pr-8 flex flex-col items-center">
                  <h2 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-6">{t('dash.complianceRisk')}</h2>
                  
                  <div className="risk-score-ring mb-6" style={{ '--ring-color': strokeColor, width: '140px', height: '140px' } as CSSProperties}>
                    <svg viewBox="0 0 100 100" aria-label="Compliance risk score">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(15, 23, 42, 0.04)" strokeWidth="8" />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={264}
                        strokeDashoffset={264 - (264 * displayRiskData.score) / 100}
                        transform="rotate(-90 50 50)"
                        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                      />
                    </svg>
                    <div className="risk-score-value text-4xl">{displayRiskData.score}%</div>
                  </div>
                  <div className={`badge ${getRiskBadgeClass(displayRiskData.riskLevel)} px-3 py-1 text-sm font-semibold`}>
                    {t(`risk.${displayRiskData.riskLevel}`)}
                  </div>
                  <button className="btn btn-outline btn-sm mt-6 w-full max-w-[200px]" onClick={() => setShowRiskBreakdown(true)}>
                    {t('ui.viewBreakdown', 'View Breakdown')}
                  </button>
                  <div className="mt-3 text-xs text-slate-400 font-medium">
                    {new Date(displayRiskData.calculatedAt).toLocaleString()}
                  </div>
                </div>

                <div className="md:border-r border-slate-200/50 md:pr-8">
                  <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">{t("dash.riskDrivers", "Risk Drivers")}</h3>
                  {displayRiskData.riskDrivers && displayRiskData.riskDrivers.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-slate-700 space-y-2">
                      {displayRiskData.riskDrivers.map((driver: string, idx: number) => (
                        <li key={idx}>{driver}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 m-0">{t("dash.zeroRiskDrivers", "0 risk drivers.")}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-4">{t("dash.recommendedActions", "Recommended Actions")}</h3>
                  {displayRiskData.recommendedActions && displayRiskData.recommendedActions.length > 0 ? (
                    <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-3">
                      {displayRiskData.recommendedActions.map((action: string, idx: number) => (
                        <li key={idx}>
                          <div className="mb-2">{action}</div>
                          <Link to="/calendar" className="btn btn-outline btn-sm px-3 py-1 text-xs">{t('ui.review')}</Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <>
                      <p className="text-sm text-slate-700 mb-3">{t("dash.noRiskAction", "No immediate risk-reduction action identified.")}</p>
                      <button className="btn btn-outline btn-sm" onClick={() => setShowRiskBreakdown(true)}>{t('ui.review', 'Review')}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* 3. Key Compliance Metrics */}
          <div className="metrics-row mb-8">
            {user?.role !== 'ACCOUNTANT' && (
              <div className="card metric-card">
                <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{t('dash.applicableObligations')}</div>
                <div className="metric-value text-slate-800">{data?.applies || 0}</div>
              </div>
            )}
            {user?.role !== 'ACCOUNTANT' && (
              <div className={`card metric-card ${data?.riskBreakdown?.critical > 0 ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{t('dash.criticalObligations')}</div>
                <div className={`metric-value ${data?.riskBreakdown?.critical > 0 ? 'text-red-600' : 'text-slate-800'}`}>{data?.riskBreakdown?.critical || 0}</div>
              </div>
            )}
            <div className={`card metric-card ${data?.evidence?.summary?.missing > 0 ? 'border-amber-200 bg-amber-50/30' : ''}`}>
              <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{user?.role === 'ACCOUNTANT' ? 'Documents to Upload' : t('dash.missingEvidence')}</div>
              <div className={`metric-value ${data?.evidence?.summary?.missing > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{data?.evidence?.summary?.missing || 0}</div>
            </div>
            {user?.role !== 'ACCOUNTANT' && (
              <div className="card metric-card">
                <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{t('dash.expiringEvidence')}</div>
                <div className="metric-value text-slate-800">{data?.evidence?.summary?.expiringSoon || 0}</div>
              </div>
            )}
            <div className={`card metric-card ${data?.calendar?.overdue > 0 ? 'border-red-200 bg-red-50/30' : ''}`}>
              <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{user?.role === 'ACCOUNTANT' ? 'My Overdue Tasks' : t('dash.overdueActions')}</div>
              <div className={`metric-value ${data?.calendar?.overdue > 0 ? 'text-red-600' : 'text-slate-800'}`}>{data?.calendar?.overdue || 0}</div>
            </div>
            <div className="card metric-card">
              <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{user?.role === 'ACCOUNTANT' ? 'My Due Soon' : t('dash.dueSoon')}</div>
              <div className="metric-value text-slate-800">{data?.calendar?.dueSoon || 0}</div>
            </div>
            <div className={`card metric-card ${data?.calendar?.completed > 0 ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
              <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{t('dash.completedActions')}</div>
              <div className="metric-value text-emerald-600">{data?.calendar?.completed || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* 4. Critical Issues */}
            <div className={`card ${topCriticalIssues.length > 0 ? 'border-red-200/60 shadow-sm' : ''}`}>
              <h2 className={`text-base font-semibold mb-4 ${topCriticalIssues.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>{t('dash.requiresAttention')}</h2>
              {topCriticalIssues.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {topCriticalIssues.map((issue: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="font-semibold text-sm text-slate-800 mb-1">{issue.title}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="text-red-600 font-medium">{issue.status}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          {t(`risk.${issue.priority}`) || issue.priority}
                        </div>
                      </div>
                      <Link to={issue.link} className="btn btn-outline btn-sm px-3 py-1.5 text-xs">{t('ui.review')}</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-8">{t('empty.noIssues')}</div>
              )}
            </div>

            {/* 5. Upcoming Deadlines */}
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-slate-800 m-0">{t('dash.upcomingCompliance')}</h2>
                <Link to="/calendar" className="btn btn-outline btn-sm px-3 py-1.5 text-xs">{t('ui.viewCalendar')}</Link>
              </div>
              {data?.calendar?.upcoming && data.calendar.upcoming.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {data.calendar.upcoming.map((action: any, i: number) => {
                    const daysRemaining = action.dueDate ? Math.ceil((new Date(action.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null;
                    const isOverdue = action.status === 'OVERDUE';
                    return (
                      <div key={i} className={`p-3 bg-slate-50/50 rounded-xl border ${isOverdue ? 'border-red-200' : 'border-slate-100'} hover:bg-slate-50 transition-colors`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-sm text-slate-800 mb-1">{action.title}</div>
                            <div className="text-xs text-slate-400 mb-1 font-mono">{action.ruleCode}</div>
                            <div className="text-xs text-slate-500">
                              {action.dueDate ? <span className={isOverdue ? 'text-red-600 font-medium' : ''}>In {daysRemaining} days</span> : `Frequency: ${action.frequency}`}
                            </div>
                            {action._id && (
                              <Link to={`/submissions/${action._id}`} className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">{t("dash.viewSubmission", "View Submission")} &rarr;</Link>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getSeverityBadge(action.priority)}
                            <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-400'}`}>{t(`status.${action.status}`) || action.status}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state py-8">{t('empty.noDeadlines')}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* 6. Evidence Gaps */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-800 mb-4">{t('dash.evidenceGaps')}</h2>
              {missingEvidences.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {missingEvidences.slice(0, 5).map((doc: any, i: number) => (
                    <div key={i} className="p-3 bg-amber-50/30 rounded-xl border border-amber-100 flex items-center justify-between hover:bg-amber-50/50 transition-colors">
                      <div>
                        <div className="font-semibold text-sm text-slate-800 mb-1">{doc.documentType}</div>
                        <div className="text-xs text-slate-500">
                          Status: <span className={`font-medium ${doc.status === 'MISSING' ? 'text-red-600' : 'text-amber-600'}`}>{t(`status.${doc.status}`) || doc.status}</span>
                        </div>
                      </div>
                      <Link to="/evidence" className="btn btn-outline btn-sm px-3 py-1.5 text-xs">{doc.status === 'MISSING' ? t('ui.upload') : t('ui.review')}</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-8">{t('empty.noGaps')}</div>
              )}
            </div>

            {/* 8. Compliance Progress */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-800 mb-4">{t('dash.complianceProgress')}</h2>
              {data?.calendar?.totalApplicable > 0 ? (
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <div className="text-sm font-medium text-slate-500">
                      {data.calendar.completed} / {data.calendar.totalApplicable} actions completed
                    </div>
                    <div className="text-3xl font-bold text-emerald-500 tracking-tight">
                      {Math.round((data.calendar.completed / data.calendar.totalApplicable) * 100)}%
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-6 shadow-inner">
                    <div style={{ width: `${(data.calendar.completed / data.calendar.totalApplicable) * 100}%` }} className="bg-emerald-500 h-full" />
                    <div style={{ width: `${(data.calendar.overdue / data.calendar.totalApplicable) * 100}%` }} className="bg-red-500 h-full" />
                    <div style={{ width: `${(data.calendar.pending / data.calendar.totalApplicable) * 100}%` }} className="bg-amber-400 h-full" />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {t('status.COMPLETED')}
                      </span>
                      <span className="font-semibold text-emerald-600">{data.calendar.completed}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        {t('status.PENDING')}
                      </span>
                      <span className="font-semibold text-amber-600">{data.calendar.pending}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        {t('status.OVERDUE')}
                      </span>
                      <span className="font-semibold text-red-600">{data.calendar.overdue}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state py-8">{t("dash.noApplicableActions", "No applicable compliance actions available yet.")}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 9. Obligation Summary */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-800 mb-4">{t('dash.obligationSummary')}</h2>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">{t('status.APPLIES')}</span>
                  <span className="font-bold text-slate-800">{data?.applies || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">{t('status.DOES_NOT_APPLY')}</span>
                  <span className="font-bold text-slate-800">{data?.doesNotApply || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-sm font-medium text-slate-600">{t('status.INSUFFICIENT_DATA')}</span>
                  <span className={`font-bold ${data?.insufficientData > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{data?.insufficientData || 0}</span>
                </div>
              </div>
              <Link to="/obligations" className="btn btn-outline btn-sm mt-4 w-full justify-center">{t('nav.obligations').replace('📋 ', '')}</Link>
            </div>

            {/* 11. Recent Activity */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-800 mb-4">{t('dash.recentActivity')}</h2>
              {data?.activity && data.activity.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {data.activity.slice(0, 4).map((log: any, i: number) => (
                    <div key={i} className="flex gap-3 items-start relative before:absolute before:left-[5px] before:top-[14px] before:bottom-[-20px] before:w-[2px] before:bg-slate-100 last:before:hidden">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 mt-1.5 relative z-10 border-2 border-white shadow-sm" />
                      <div>
                        <div className="text-sm font-medium text-slate-800 leading-tight mb-1">{log.action.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-slate-400 font-medium">{new Date(log.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-8">{t('empty.noActivity')}</div>
              )}
            </div>

            {/* 12. Risk Trend */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-800 mb-4">{t('dash.riskTrend')}</h2>
              {data?.history && data.history.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {data.history.map((hist: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
                      <span className="text-sm font-medium text-slate-500">
                        {new Date(hist.calculatedAt).toLocaleDateString()}
                      </span>
                      <span className={`text-sm font-bold ${
                        hist.riskLevel === 'CRITICAL' ? 'text-red-600' :
                        hist.riskLevel === 'HIGH' ? 'text-amber-600' :
                        hist.riskLevel === 'MODERATE' ? 'text-blue-600' :
                        'text-emerald-600'
                      }`}>
                        {hist.score} <span className="font-medium text-xs ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">({t(`risk.${hist.riskLevel}`)})</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-8">{t('empty.noTrend')}</div>
              )}
            </div>
          </div>
          </>
        )}
    </AppLayout>
  );
};

export default Dashboard;
