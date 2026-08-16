import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import AppLayout from '../components/AppLayout';

const Obligations = () => {
  const { token, user, loading: authLoading, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [obligations, setObligations] = useState<any[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { navigate('/login'); return; }

    const fetch = async () => {
      try {
        const [oblRes, evRes] = await Promise.all([
          axios.get('http://localhost:5000/api/obligations', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get('http://localhost:5000/api/evidence', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        setObligations(oblRes.data.data);
        
        const evMap: Record<string, any[]> = {};
        for (const ev of evRes.data.data) {
          if (!evMap[ev.obligationCode]) evMap[ev.obligationCode] = [];
          evMap[ev.obligationCode].push(ev);
        }
        setEvidenceMap(evMap);
        
      } catch (err: any) {
        if (err.response?.status === 401) { logout(); navigate('/login'); }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token, authLoading, logout, navigate]);

  if (authLoading || loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>{t('loading', 'Loading...')}</div>;
  }

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case 'CRITICAL': return <span className="badge badge-red">{t(`risk.${s}`) || 'Critical'}</span>;
      case 'HIGH': return <span className="badge badge-amber">{t(`risk.${s}`) || 'High'}</span>;
      case 'MEDIUM': return <span className="badge badge-blue">{t('risk.MODERATE') || 'Medium'}</span>;
      default: return <span className="badge badge-green">{t('risk.LOW') || 'Low'}</span>;
    }
  };

  const getApplicabilityBadge = (a: string) => {
    switch (a) {
      case 'APPLIES': return <span className="badge badge-red">{t('status.APPLIES')}</span>;
      case 'DOES_NOT_APPLY': return <span className="badge badge-green">{t('status.DOES_NOT_APPLY')}</span>;
      default: return <span className="badge badge-amber">{t('status.INSUFFICIENT_DATA')}</span>;
    }
  };

  const domains = ['ALL', ...Array.from(new Set(obligations.map(o => o.domain)))];
  
  const filtered = obligations.filter(o => {
    const oblStatus = o.status || o.applicability;
    if (filter !== 'ALL' && oblStatus !== filter) return false;
    if (domainFilter !== 'ALL' && o.domain !== domainFilter) return false;
    return true;
  });

  return (
    <AppLayout pageTitle={t('nav.obligations')}>
      <div className="card mb-24">
        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)} style={{ minWidth: '180px' }}>
              <option value="ALL">All Applicability</option>
              <option value="APPLIES">{t('status.APPLIES')}</option>
              <option value="DOES_NOT_APPLY">{t('status.DOES_NOT_APPLY')}</option>
              <option value="INSUFFICIENT_DATA">{t('status.INSUFFICIENT_DATA')}</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <select className="form-input" value={domainFilter} onChange={e => setDomainFilter(e.target.value)} style={{ minWidth: '180px' }}>
              {domains.map(d => <option key={d} value={d}>{d === 'ALL' ? 'All Domains' : d}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Obligation</th>
                  <th>Domain</th>
                  <th>Severity</th>
                  <th>Applicability</th>
                  <th>Cadence</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((obl, i) => (
                  <tr key={obl._id || i} onClick={() => setSelected(obl)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{obl.code}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{obl.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{obl.regulator}</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{obl.domain}</td>
                    <td>{getSeverityBadge(obl.severity)}</td>
                    <td>{getApplicabilityBadge(obl.status || obl.applicability)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{obl.cadence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selected.code}</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, paddingRight: '32px', lineHeight: 1.3 }}>{selected.title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>{selected.authority}</p>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {(selected.status || selected.applicability) === 'APPLIES' && (
              <div style={{ padding: '0 32px' }}>
                <button className="btn btn-accent" onClick={() => navigate(`/document-preparation/${encodeURIComponent(selected.code)}`)}>
                  {t('documents.prepareDocument', 'Prepare document')}
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', margin: '32px 0' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Domain</div>
                <div style={{ fontWeight: 600 }}>{selected.domain}</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Cadence</div>
                <div style={{ fontWeight: 600 }}>{selected.cadence}</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Severity</div>
                <div style={{ fontWeight: 600 }}>{t(`risk.${selected.severity}`) || selected.severity}</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '24px', padding: '24px 32px', borderLeft: `4px solid ${selected.status === 'APPLIES' ? 'var(--danger)' : selected.status === 'DOES_NOT_APPLY' ? 'var(--success)' : 'var(--warning)'}` }}>
              <div className="card-title micro" style={{ color: 'inherit' }}>
                {selected.status === 'APPLIES' && 'Why this applies'}
                {selected.status === 'DOES_NOT_APPLY' && 'Why this does not apply'}
                {selected.status === 'INSUFFICIENT_DATA' && 'Information required'}
              </div>
              <p style={{ fontSize: '0.95rem', marginBottom: '24px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selected.explanation || 'Explanation not available.'}
              </p>

              {selected.conditionsEvaluated && selected.conditionsEvaluated.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
                  {selected.conditionsEvaluated.map((cond: any, idx: number) => {
                    let icon = '❌';
                    if (cond.missing) icon = '⚠️';
                    else if (cond.matched) icon = '✓';
                    
                    let valStr = '';
                    if (cond.missing) {
                      valStr = cond.readableField ? cond.readableField.charAt(0).toUpperCase() + cond.readableField.slice(1) : cond.field;
                    } else if (typeof cond.actualValue === 'boolean') {
                      valStr = `${cond.actualValue ? 'Yes' : 'No'} — ${cond.readableField || cond.field}`;
                    } else {
                      valStr = `${cond.actualValue} ${cond.operator === '>=' ? (cond.readableField || cond.field) : ''}`.trim();
                      if (cond.operator !== '>=') {
                         valStr = `${valStr} — ${cond.readableField ? cond.readableField.charAt(0).toUpperCase() + cond.readableField.slice(1) : cond.field}`;
                      }
                    }

                    return (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '1.25rem', marginTop: '-4px', fontWeight: 'bold', color: cond.matched ? 'var(--success)' : cond.missing ? 'var(--warning)' : 'var(--danger)', textAlign: 'center' }}>
                          {icon}
                        </span>
                        <div style={{ lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600 }}>{valStr}</span>
                          <span style={{ color: 'var(--text-secondary)' }}> — {cond.explanation}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                <div className="card-title micro">Result</div>
                <div style={{ fontWeight: 700, fontSize: '1.25rem', color: selected.status === 'APPLIES' ? 'var(--danger)' : selected.status === 'DOES_NOT_APPLY' ? 'var(--success)' : 'var(--warning)', letterSpacing: '-0.02em' }}>
                  {t(`status.${selected.status}`) || selected.status}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '24px', padding: '24px 32px', background: 'rgba(255,255,255,0.02)' }}>
              <div className="card-title micro">Next Steps</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selected.action || 'Review the obligation details and required evidence.'}
              </p>
            </div>

            <div className="card" style={{ marginBottom: '24px', padding: '24px 32px', background: 'rgba(255,255,255,0.015)' }}>
              <div className="card-title micro">Description</div>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{selected.description}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 8px', marginBottom: '32px' }}>
              <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}><span className="label" style={{ color: 'var(--text-muted)' }}>Authority</span><span className="value" style={{ fontWeight: 500 }}>{selected.authority || selected.regulator}</span></div>
              <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}><span className="label" style={{ color: 'var(--text-muted)' }}>Jurisdiction</span><span className="value" style={{ fontWeight: 500 }}>{selected.jurisdiction}</span></div>
              <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}><span className="label" style={{ color: 'var(--text-muted)' }}>Cadence</span><span className="value" style={{ fontWeight: 500 }}>{selected.cadence}</span></div>
              <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}><span className="label" style={{ color: 'var(--text-muted)' }}>Penalty</span><span className="value" style={{ color: 'var(--danger)', fontWeight: 500 }}>{selected.penalty || 'Not specified'}</span></div>
              <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}><span className="label" style={{ color: 'var(--text-muted)' }}>Imprisonment Risk</span><span className="value" style={{ fontWeight: 500 }}>{selected.imprisonmentFlag ? '⚠️ Yes' : 'No'}</span></div>
              <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}><span className="label" style={{ color: 'var(--text-muted)' }}>License Suspension</span><span className="value" style={{ fontWeight: 500 }}>{selected.licenceSuspensionFlag ? '⚠️ Yes' : 'No'}</span></div>
            </div>

            <div className="card" style={{ marginBottom: '24px', padding: '24px 32px', background: 'rgba(255,255,255,0.015)' }}>
              <div className="card-title micro">Regulatory Source</div>
              {selected.regulatorySource ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gap: '8px' }}>
                  <div><strong>Source:</strong> {selected.regulatorySource.sourceName}</div>
                  <div><strong>Act/Regulation:</strong> {selected.regulatorySource.actName}</div>
                  <div><strong>Section:</strong> {selected.regulatorySource.sectionNumber}</div>
                  <div style={{ marginTop: '4px' }}>
                    <a href={selected.regulatorySource.officialUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>
                      View Official Source ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Source verification information is not available.</div>
              )}
            </div>

            {selected.requiredEvidenceTypes?.length > 0 && (
              <div>
                <div className="card-title" style={{ marginBottom: '8px' }}>Evidence</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selected.requiredEvidenceTypes.map((evType: string, i: number) => {
                    const uploadedMatch = evidenceMap[selected.code]?.find(e => e.documentType === evType);
                    return (
                      <div key={i} style={{ padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{evType}</div>
                          {uploadedMatch ? (
                            <span className="badge badge-green">{t('status.UPLOADED')}</span>
                          ) : (
                            <span className="badge badge-red">{t('status.MISSING')}</span>
                          )}
                        </div>
                        {uploadedMatch ? (
                          <>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              Expiry: {uploadedMatch.expiryDate ? new Date(uploadedMatch.expiryDate).toLocaleDateString() : 'None'} <br/>
                              Verification: {t(`status.${uploadedMatch.verificationStatus}`) || uploadedMatch.verificationStatus}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn btn-outline btn-sm" onClick={() => window.open(`http://localhost:5000/api/evidence/${uploadedMatch._id}/download?token=${token}`, '_blank')}>View File</button>
                              <button className="btn btn-accent btn-sm" onClick={() => navigate('/evidence')}>Manage</button>
                            </div>
                          </>
                        ) : (
                          <button className="btn btn-accent btn-sm" onClick={() => navigate('/evidence')}>{t('ui.upload')}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default Obligations;
