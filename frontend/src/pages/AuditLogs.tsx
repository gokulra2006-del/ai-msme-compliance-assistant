import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { DEMO_AUDIT_LOGS } from '../demoData';

const AuditLogs = () => {
  const { token, user, loading: authLoading, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { navigate('/login'); return; }

    const fetchLogs = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`http://localhost:5000/api/audit-logs?page=${page}&limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(res.data.data);
        setTotalPages(res.data.totalPages);
      } catch (err: any) {
        if (err.response?.status === 401) { logout(); navigate('/login'); return; }
        if (err.response?.status === 403) { navigate('/dashboard'); return; }
        console.warn('[AuditLogs] API unavailable, using demo data.');
        const demoLogs = DEMO_AUDIT_LOGS.map(l => ({
          ...l,
          actorRole: l.user?.role || 'SYSTEM',
          entity: l.details ? Object.values(l.details)[0] : '-',
          metadata: l.details,
        }));
        setLogs(demoLogs);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [token, authLoading, page, navigate, logout]);

  if (authLoading || loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>Loading Audit Logs...</div>;
  }

  return (
    <AppLayout pageTitle="System Audit Trail (Append-Only)">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {logs.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px' }}>No audit records found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="evidence-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                      <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Time</th>
                      <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>User</th>
                      <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Role</th>
                      <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Action</th>
                      <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Entity</th>
                      <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px', fontSize: '0.9rem' }}>{new Date(log.createdAt).toLocaleString()}</td>
                        <td style={{ padding: '16px', fontSize: '0.9rem' }}>{log.user?.name || log.user?.email || 'SYSTEM'}</td>
                        <td style={{ padding: '16px', fontSize: '0.85rem' }}><span className="badge badge-muted">{log.actorRole || 'SYSTEM'}</span></td>
                        <td style={{ padding: '16px', fontSize: '0.9rem', fontWeight: 600 }}>{log.action}</td>
                        <td style={{ padding: '16px', fontSize: '0.9rem' }}>{log.entity || '-'}</td>
                        <td style={{ padding: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {log.metadata ? JSON.stringify(log.metadata).substring(0, 50) + (JSON.stringify(log.metadata).length > 50 ? '...' : '') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span style={{ color: 'var(--text-secondary)' }}>Page {page} of {totalPages || 1}</span>
            <button className="btn btn-outline" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
    </AppLayout>
  );
};

export default AuditLogs;
