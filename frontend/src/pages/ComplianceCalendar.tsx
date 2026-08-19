import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getActions, syncActions, markCompleted, reopenAction } from '../api/complianceActions';
import { Calendar, List, CheckCircle, Clock, AlertCircle, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import AppLayout from '../components/AppLayout';

const ComplianceCalendar = () => {
  const { token, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [filter, setFilter] = useState('ALL');
  
  // Drawer state
  const [selectedAction, setSelectedAction] = useState<any | null>(null);
  const { user } = useContext(AuthContext);
  const [businessUsers, setBusinessUsers] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchActions = async () => {
    if (!token) return;
    try {
      const res = await getActions(token);
      setActions(res.data.data);
      
      if (user?.role === 'OWNER' || user?.role === 'COMPLIANCE_OFFICER') {
        const { getBusinessUsers } = await import('../api/complianceActions');
        const usersRes = await getBusinessUsers(token);
        setBusinessUsers(usersRes.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 401) navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      await syncActions(token);
      await fetchActions();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!token) navigate('/login');
      else {
        fetchActions();
      }
    }
  }, [authLoading, token, navigate]);

  const handleComplete = async (id: string) => {
    if (!window.confirm("Are you sure you want to mark this compliance action as completed?")) return;
    try {
      await markCompleted(id, token!);
      await fetchActions();
      setSelectedAction((prev: any) => prev && prev._id === id ? { ...prev, status: 'COMPLETED', completionDate: new Date() } : prev);
    } catch (err) {
      console.error(err);
      alert('Failed to mark completed');
    }
  };

  const handleWorkflow = async (actionId: string, type: string) => {
    try {
      const { submitActionReview, approveAction, rejectAction } = await import('../api/complianceActions');
      if (type === 'SUBMIT') {
        await submitActionReview(actionId, token!);
        alert('Submitted for review successfully');
      } else if (type === 'APPROVE') {
        await approveAction(actionId, token!);
        alert('Action approved successfully');
      } else if (type === 'REJECT') {
        if (!rejectReason) return alert('Rejection reason required');
        await rejectAction(actionId, rejectReason, token!);
        setShowRejectModal(false);
        setRejectReason('');
        alert('Action rejected');
      }
      await fetchActions();
      setSelectedAction(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Workflow action failed');
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      const { assignAction } = await import('../api/complianceActions');
      await assignAction(selectedAction._id, userId, token!);
      alert('Action assigned successfully');
      await fetchActions();
      setSelectedAction((prev: any) => ({ ...prev, assignedTo: userId, status: 'ASSIGNED' }));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Assignment failed');
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await reopenAction(id, token!);
      await fetchActions();
      setSelectedAction((prev: any) => prev && prev._id === id ? { ...prev, status: 'ON_TRACK', completionDate: null } : prev);
    } catch (err) {
      console.error(err);
      alert('Failed to reopen action');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="badge badge-green"><CheckCircle size={14} style={{ marginRight: 4 }}/> {t('status.COMPLETED')}</span>;
      case 'OVERDUE': return <span className="badge badge-red"><AlertCircle size={14} style={{ marginRight: 4 }}/> {t('status.OVERDUE')}</span>;
      case 'DUE_SOON': return <span className="badge badge-amber"><Clock size={14} style={{ marginRight: 4 }}/> {t('status.DUE_SOON')}</span>;
      case 'NEEDS_REVIEW': return <span className="badge badge-blue"><AlertTriangle size={14} style={{ marginRight: 4 }}/> {t('status.PENDING')}</span>;
      case 'ON_TRACK': return <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>{t('status.ON_TRACK')}</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getPriorityBadge = (s: string) => {
    switch (s) {
      case 'CRITICAL': return <span className="badge badge-red">{t(`risk.${s}`) || 'Critical'}</span>;
      case 'HIGH': return <span className="badge badge-amber">{t(`risk.${s}`) || 'High'}</span>;
      case 'MEDIUM': return <span className="badge badge-blue">{t('risk.MODERATE') || 'Medium'}</span>;
      case 'LOW': return <span className="badge badge-green">{t('risk.LOW') || 'Low'}</span>;
      default: return null;
    }
  };

  const filteredActions = actions.filter(a => {
    if (filter === 'ALL') return true;
    return a.status === filter;
  });

  if (authLoading || loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>{t('loading', 'Loading...')}</div>;
  }

  return (
    <AppLayout pageTitle={t('topbar.calendar')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn btn-sm ${filter === 'ALL' ? 'btn-accent' : 'btn-outline'}`} onClick={() => setFilter('ALL')}>All Actions</button>
          <button className={`btn btn-sm ${filter === 'OVERDUE' ? 'btn-accent' : 'btn-outline'}`} onClick={() => setFilter('OVERDUE')}>{t('status.OVERDUE')}</button>
          <button className={`btn btn-sm ${filter === 'DUE_SOON' ? 'btn-accent' : 'btn-outline'}`} onClick={() => setFilter('DUE_SOON')}>{t('status.DUE_SOON')}</button>
          <button className={`btn btn-sm ${filter === 'COMPLETED' ? 'btn-accent' : 'btn-outline'}`} onClick={() => setFilter('COMPLETED')}>{t('status.COMPLETED')}</button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <LanguageSelector />
          <button 
            className="btn btn-outline btn-sm" 
            onClick={handleSync} 
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={syncing ? "spin" : ""} />
            {syncing ? 'Syncing...' : 'Sync with Rules Engine'}
          </button>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
            <button 
              onClick={() => setViewMode('LIST')}
              style={{ padding: '6px 12px', borderRadius: '4px', background: viewMode === 'LIST' ? 'var(--bg-card)' : 'transparent', color: viewMode === 'LIST' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <List size={16} /> List
            </button>
            <button 
              onClick={() => setViewMode('CALENDAR')}
              style={{ padding: '6px 12px', borderRadius: '4px', background: viewMode === 'CALENDAR' ? 'var(--bg-card)' : 'transparent', color: viewMode === 'CALENDAR' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={16} /> Calendar
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        {filteredActions.length === 0 ? (
          <div className="empty-state">{t('empty.noDeadlines')}</div>
        ) : viewMode === 'LIST' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Compliance Action</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredActions.map(action => (
                  <tr key={action._id} onClick={() => setSelectedAction(action)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{action.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{action.ruleCode}</div>
                    </td>
                    <td>{action.category}</td>
                    <td style={{ color: action.dueDate ? 'inherit' : 'var(--text-muted)' }}>
                      {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : `${action.frequency} (No exact date)`}
                    </td>
                    <td>{getPriorityBadge(action.priority)}</td>
                    <td>{getStatusBadge(action.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Calendar grid view is a placeholder in this template. Please use the list view.
          </div>
        )}
      </div>

      {/* Action Details Drawer */}
      {selectedAction && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedAction(null)} />
          <div className="drawer fade-in">
            <div className="drawer-header">
              <div>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedAction.ruleCode}</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, paddingRight: '32px', lineHeight: 1.3 }}>{selectedAction.title}</h2>
              </div>
              <button className="drawer-close" onClick={() => setSelectedAction(null)}>✕</button>
            </div>
            
            <div className="drawer-content">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '16px 0 32px 0' }}>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</div>
                  <div style={{ fontWeight: 600 }}>{getStatusBadge(selectedAction.status)}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Due Date</div>
                  <div style={{ fontWeight: 600 }}>{selectedAction.dueDate ? new Date(selectedAction.dueDate).toLocaleDateString() : 'Needs confirmation'}</div>
                </div>
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Priority</div>
                  <div style={{ fontWeight: 600 }}>{getPriorityBadge(selectedAction.priority)}</div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '24px', padding: '24px 32px', background: 'rgba(255,255,255,0.015)' }}>
                <div className="card-title micro">{t('obl.description', 'Description')}</div>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{selectedAction.description}</p>
              </div>

              <div className="card" style={{ marginBottom: '24px', padding: '24px 32px', borderLeft: '4px solid var(--accent-light)' }}>
                <div className="card-title micro" style={{ color: 'inherit' }}><FileText size={14} style={{ display: 'inline', marginRight: 4 }}/> Evidence Required</div>
                {selectedAction.evidenceRequired && selectedAction.evidenceRequired.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {selectedAction.evidenceRequired.map((ev: string, i: number) => (
                      <li key={i} style={{ marginBottom: '8px' }}>{ev}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>No explicit evidence documented for this action.</p>
                )}
                <div style={{ marginTop: '16px' }}>
                  <button className="btn btn-outline btn-sm">Attach Evidence</button>
                </div>
              </div>

              {selectedAction.status === 'ASSIGNED' || selectedAction.status === 'IN_PROGRESS' || selectedAction.status === 'REJECTED' || selectedAction.status === 'ON_TRACK' || selectedAction.status === 'OVERDUE' || selectedAction.status === 'DUE_SOON' || selectedAction.status === 'PENDING' ? (
                <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {(user?.role === 'OWNER' || user?.role === 'COMPLIANCE_OFFICER') && (
                      <select 
                        className="input" 
                        style={{ padding: '6px 12px', width: 'auto' }}
                        value={selectedAction.assignedTo || ''}
                        onChange={(e) => handleAssign(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {businessUsers.map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-outline" onClick={() => setSelectedAction(null)}>{t('ui.close')}</button>
                    {(user?.role === 'ACCOUNTANT' || user?.role === 'OWNER') && (
                       <button className="btn btn-accent" onClick={() => handleWorkflow(selectedAction._id, 'SUBMIT')}>Submit for Review</button>
                    )}
                    <button className="btn btn-primary" onClick={() => navigate(`/submissions/${selectedAction._id}`)}>
                      Regulatory Submission Assistance
                    </button>
                  </div>
                </div>
              ) : selectedAction.status === 'SUBMITTED_FOR_REVIEW' ? (
                <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-outline" onClick={() => setSelectedAction(null)}>{t('ui.close')}</button>
                  {(user?.role === 'COMPLIANCE_OFFICER' || user?.role === 'OWNER') && (
                    <>
                      <button className="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => setShowRejectModal(true)}>Reject</button>
                      <button className="btn btn-accent" style={{ background: 'var(--success)' }} onClick={() => handleWorkflow(selectedAction._id, 'APPROVE')}>Approve</button>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button className="btn btn-outline" onClick={() => setSelectedAction(null)}>{t('ui.close')}</button>
                  {(user?.role === 'OWNER' || user?.role === 'COMPLIANCE_OFFICER') && (
                    <button className="btn btn-outline" onClick={() => handleReopen(selectedAction._id)}>Reopen Action</button>
                  )}
                </div>
              )}
            </div>
            
            {showRejectModal && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div className="card" style={{ width: '400px', background: 'var(--bg-elevated)' }}>
                    <h3 style={{ marginTop: 0 }}>Reject Action</h3>
                    <textarea 
                      className="input" 
                      style={{ width: '100%', height: '100px', marginBottom: '16px' }} 
                      placeholder="Enter rejection reason..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button className="btn btn-outline" onClick={() => setShowRejectModal(false)}>{t("ui.cancel", "Cancel")}</button>
                      <button className="btn btn-accent" style={{ background: 'var(--danger)' }} onClick={() => handleWorkflow(selectedAction._id, 'REJECT')}>Confirm Reject</button>
                    </div>
                 </div>
              </div>
            )}
            </div>
        </>
      )}
    </AppLayout>
  );
};

export default ComplianceCalendar;
