import { useState, useEffect, ReactNode, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, LayoutDashboard, Bot, Calendar, ClipboardList, FolderLock, Settings, Users, Building2, ScrollText, LogOut, ShieldCheck, Bell, Circle, FilePenLine, Beaker, Database } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';
import axios from 'axios';

interface AppLayoutProps {
  children: ReactNode;
  pageTitle?: string;
  userData?: any; // For topbar (industry, state)
}

export default function AppLayout({ children, pageTitle, userData }: AppLayoutProps) {
  const { user, logout } = useContext(AuthContext);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return localStorage.getItem('sidebarOpen') !== 'false';
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);



  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen.toString());
  }, [sidebarOpen]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get('http://localhost:5000/api/notifications', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data.data);
        setUnreadCount(res.data.data.filter((n: any) => n.status !== 'READ').length);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAsRead = async (n: any) => {
    try {
      if (n.status !== 'READ') {
        const token = localStorage.getItem('token');
        await axios.put(`http://localhost:5000/api/notifications/${n._id}/read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(notif => notif._id === n._id ? { ...notif, status: 'READ' } : notif));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      setShowNotifications(false);
      
      // Navigate based on type
      if (n.reminderType === 'EVIDENCE_EXPIRING') {
        navigate('/evidence');
      } else {
        navigate('/calendar');
      }
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'var(--danger)';
      case 'HIGH': return 'var(--warning)';
      case 'MEDIUM': return 'var(--accent-light)';
      case 'LOW': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className="sidebar">
        <div className="sidebar-brand" onClick={() => setSidebarOpen(true)} style={{ cursor: 'pointer' }}>
          <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '28px', height: '28px' }}>
            <img src="/logo.svg" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span>SurakshaSetu AI</span>
        </div>
        <nav className="sidebar-nav">
          <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}><LayoutDashboard size={18} /> <span>{t('nav.dashboard', 'Command Center')}</span></Link>
          <Link to="/assistant" className={`nav-link ${location.pathname === '/assistant' ? 'active' : ''}`}><Bot size={18} /> <span>{t('nav.assistant', 'Assistant')}</span></Link>
          <Link to="/document-preparation" className={`nav-link ${location.pathname.startsWith('/document-preparation') ? 'active' : ''}`}><FilePenLine size={18} /> <span>{t('nav.documentPreparation', 'Document Preparation')}</span></Link>
          
          {user?.role === 'ADMIN' && (
            <>
              <Link to="/users" className={`nav-link ${location.pathname === '/users' ? 'active' : ''}`}><Users size={18} /> <span>Users</span></Link>
              <Link to="/simulator" className={`nav-link ${location.pathname === '/simulator' ? 'active' : ''}`}><Beaker size={18} /> <span>Admin Simulator</span></Link>
              <Link to="/businesses" className={`nav-link ${location.pathname === '/businesses' ? 'active' : ''}`}><Building2 size={18} /> <span>Businesses</span></Link>
              <Link to="/audit-logs" className={`nav-link ${location.pathname === '/audit-logs' ? 'active' : ''}`}><ScrollText size={18} /> <span>Audit Logs</span></Link>
              <Link to="/inspection-readiness" className={`nav-link ${location.pathname === '/inspection-readiness' ? 'active' : ''}`}><ShieldCheck size={18} /> <span>Inspection Readiness</span></Link>
            </>
          )}

          {user?.role === 'COMPLIANCE_OFFICER' && (
            <>
              <Link to="/obligations" className={`nav-link ${location.pathname === '/obligations' ? 'active' : ''}`}><ClipboardList size={18} /> <span>{t('nav.obligations', 'Obligations')}</span></Link>
              <Link to="/evidence" className={`nav-link ${location.pathname === '/evidence' ? 'active' : ''}`}><FolderLock size={18} /> <span>Evidence Review</span></Link>
              <Link to="/calendar" className={`nav-link ${location.pathname === '/calendar' ? 'active' : ''}`}><Calendar size={18} /> <span>{t('nav.calendar', 'Calendar')}</span></Link>
              <Link to="/inspection-readiness" className={`nav-link ${location.pathname === '/inspection-readiness' ? 'active' : ''}`}><ShieldCheck size={18} /> <span>Inspection Readiness</span></Link>
              <Link to="/audit-logs" className={`nav-link ${location.pathname === '/audit-logs' ? 'active' : ''}`}><ScrollText size={18} /> <span>Audit Activity</span></Link>
            </>
          )}

          {user?.role === 'ACCOUNTANT' && (
            <>
              <Link to="/obligations" className={`nav-link ${location.pathname === '/obligations' ? 'active' : ''}`}><ClipboardList size={18} /> <span>Financial Compliance</span></Link>
              <Link to="/evidence" className={`nav-link ${location.pathname === '/evidence' ? 'active' : ''}`}><FolderLock size={18} /> <span>Financial Evidence</span></Link>
              <Link to="/calendar" className={`nav-link ${location.pathname === '/calendar' ? 'active' : ''}`}><Calendar size={18} /> <span>Filing Calendar</span></Link>
            </>
          )}

          {(user?.role === 'OWNER' || !user?.role) && (
            <>
              <Link to="/digital-twin" className={`nav-link ${location.pathname === '/digital-twin' ? 'active' : ''}`}><Database size={18} /> <span>Digital Twin</span></Link>
              <Link to="/calendar" className={`nav-link ${location.pathname === '/calendar' ? 'active' : ''}`}><Calendar size={18} /> <span>{t('nav.calendar', 'Calendar')}</span></Link>
              <Link to="/obligations" className={`nav-link ${location.pathname === '/obligations' ? 'active' : ''}`}><ClipboardList size={18} /> <span>{t('nav.obligations', 'Obligations')}</span></Link>
              <Link to="/evidence" className={`nav-link ${location.pathname === '/evidence' ? 'active' : ''}`}><FolderLock size={18} /> <span>{t('nav.evidence', 'Evidence Vault')}</span></Link>
              <Link to="/simulator" className={`nav-link ${location.pathname === '/simulator' ? 'active' : ''}`}><Beaker size={18} /> <span>Simulator</span></Link>
              <Link to="/inspection-readiness" className={`nav-link ${location.pathname === '/inspection-readiness' ? 'active' : ''}`}><ShieldCheck size={18} /> <span>Inspection Readiness</span></Link>
              <Link to="/onboarding" className={`nav-link ${location.pathname === '/onboarding' ? 'active' : ''}`}><Settings size={18} /> <span>{t('nav.editProfile', 'Edit Profile')}</span></Link>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            <span>Signed in as {user?.name || user?.email}</span>
          </div>
          <button className="btn btn-outline btn-sm" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => { logout(); navigate('/login'); }}>
            <LogOut size={16} /> <span>{t('nav.signOut', 'Sign Out')}</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {sidebarOpen && <Menu size={20} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSidebarOpen(false)} />}
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{pageTitle || t('topbar.commandCenter')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {user && (
              <div style={{ position: 'relative' }}>
                <Bell 
                  size={20} 
                  style={{ cursor: 'pointer', color: 'var(--text-primary)' }} 
                  onClick={() => setShowNotifications(!showNotifications)}
                />
                {unreadCount > 0 && (
                  <div style={{ position: 'absolute', top: -5, right: -5, background: 'red', color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold' }}>
                    {unreadCount}
                  </div>
                )}
                
                {showNotifications && (
                  <div style={{ position: 'absolute', top: 30, right: 0, width: 380, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 100, maxHeight: 500, overflowY: 'auto' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 101 }}>
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }} onClick={async () => {
                          const token = localStorage.getItem('token');
                          await axios.put('http://localhost:5000/api/notifications/mark-all-read', {}, { headers: { Authorization: `Bearer ${token}` }});
                          setNotifications(prev => prev.map(n => ({...n, status: 'READ'})));
                          setUnreadCount(0);
                        }}>Mark all as read</span>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>You have no notifications</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {notifications.map((n, i) => (
                          <div 
                            key={i} 
                            style={{ 
                              padding: '12px 16px', 
                              borderBottom: '1px solid var(--border)', 
                              cursor: 'pointer', 
                              background: n.status === 'READ' ? 'transparent' : 'rgba(255,255,255,0.03)',
                              transition: 'background 0.2s',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start'
                            }} 
                            onClick={() => handleMarkAsRead(n)}
                            className="notification-item"
                          >
                            <div style={{ marginTop: '4px' }}>
                              <Circle size={10} fill={n.status !== 'READ' ? getSeverityColor(n.severity) : 'transparent'} color={getSeverityColor(n.severity)} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                  {new Date(n.scheduledFor).toLocaleDateString()}
                                </div>
                              </div>
                              <div style={{ fontSize: 13, color: n.status === 'READ' ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: 1.4 }}>{n.message}</div>
                              {n.reminderType === 'ESCALATION' && (
                                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: '6px', fontWeight: 500 }}>⚠️ Escalated to {n.recipientRole}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <LanguageSelector />
            <div className="topbar-user" style={{ position: 'relative' }}>
              {userData?.industry && <span>{userData.industry} • {userData.state}</span>}
              <div 
                className="avatar" 
                style={{ cursor: 'pointer' }}
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {user?.name?.[0] || 'U'}
              </div>
              
              {showUserMenu && (
                <div style={{
                  position: 'absolute',
                  top: 40,
                  right: 0,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  minWidth: '150px',
                  padding: '8px'
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Signed in as<br />
                    <strong style={{ color: 'var(--text-primary)' }}>{user?.name || user?.email}</strong>
                  </div>
                  <button 
                    onClick={() => { setShowUserMenu(false); logout(); navigate('/login'); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={16} /> {t('nav.signOut', 'Sign Out')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
