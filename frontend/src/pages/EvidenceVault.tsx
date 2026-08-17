import { useEffect, useState, useContext, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';

/** Finding severity → the badge classes the rest of this page already uses. */
const DQ_SEVERITY_BADGE: Record<string, string> = {
  HIGH: 'badge-red',
  MEDIUM: 'badge-amber',
  LOW: 'badge-muted'
};

/** `OBLIGATION_MISSING_EVIDENCE` → `Obligation missing evidence`. */
const humanizeFindingCode = (code: string) =>
  (code || '').toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/**
 * One readable line per flagged record. The audit reports two record shapes —
 * evidence references and required-document rows — so read whichever fields are
 * present rather than assuming a single shape.
 */
const describeFindingRecord = (record: any): string => {
  if (!record || typeof record !== 'object') return String(record ?? '');

  const label =
    record.documentName || record.documentType || record.obligationTitle || record.obligationCode || 'Record';

  const context = [
    record.documentType && record.documentType !== label ? record.documentType : null,
    record.obligationTitle || record.obligationCode || null,
    record.expiryDate ? `expired ${new Date(record.expiryDate).toLocaleDateString()}` : null,
    Array.isArray(record.reasons) && record.reasons.length ? record.reasons.join('; ') : null
  ].filter(Boolean);

  return context.length ? `${label} — ${context.join(' · ')}` : label;
};

const EvidenceVault = () => {
  const { token, user, loading: authLoading, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [dashboard, setDashboard] = useState<any>(null);
  const [allEvidence, setAllEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [obligations, setObligations] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [correctionLoading, setCorrectionLoading] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterVerification, setFilterVerification] = useState('');
  const [filterExpiry, setFilterExpiry] = useState('');

  // Data Quality Audit State
  const [showDataQuality, setShowDataQuality] = useState(false);
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [dqLoading, setDqLoading] = useState(false);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    obligationCode: '',
    documentType: '',
    documentName: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
    file: null as File | null
  });

  const API = 'http://localhost:5000/api';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [dashRes, evidenceRes, oblRes] = await Promise.all([
        axios.get(`${API}/evidence/dashboard`, { headers }),
        axios.get(`${API}/evidence?latest=true`, { headers }),
        axios.get(`${API}/obligations`, { headers })
      ]);
      setDashboard(dashRes.data.data);
      setAllEvidence(evidenceRes.data.data);
      setObligations(oblRes.data.data.filter((o: any) => o.applicability === 'APPLIES'));
    } catch (err: any) {
      if (err.response?.status === 401) { logout(); navigate('/login'); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!token) { navigate('/login'); return; }
    fetchData();
  }, [token, authLoading, logout, navigate]);

  const fetchDataQuality = async () => {
    setDqLoading(true);
    try {
      const res = await axios.get(`${API}/evidence/data-quality`, { headers });
      setDataQuality(res.data.data);
      setShowDataQuality(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to fetch Data Quality Audit');
    } finally {
      setDqLoading(false);
    }
  };

  /**
   * The single entry point for the upload drawer, so a stale error or success
   * banner from an earlier attempt never greets a fresh one.
   */
  const openUpload = (prefill?: Partial<typeof uploadForm>) => {
    setUploadError('');
    setUploadSuccess('');
    if (prefill) setUploadForm(prev => ({ ...prev, ...prefill }));
    setShowUpload(true);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.obligationCode || !uploadForm.documentType || !uploadForm.documentName) {
      setUploadError('Please fill all required fields and select a file.');
      return;
    }
    setUploadLoading(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('obligationCode', uploadForm.obligationCode);
    formData.append('documentType', uploadForm.documentType);
    formData.append('documentName', uploadForm.documentName);
    if (uploadForm.issueDate) formData.append('issueDate', uploadForm.issueDate);
    if (uploadForm.expiryDate) formData.append('expiryDate', uploadForm.expiryDate);
    if (uploadForm.notes) formData.append('notes', uploadForm.notes);

    try {
      await axios.post(`${API}/evidence/upload`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      setUploadSuccess('Document uploaded successfully!');
      setUploadForm({ obligationCode: '', documentType: '', documentName: '', issueDate: '', expiryDate: '', notes: '', file: null });
      setShowUpload(false);
      fetchData(); // refresh
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.duplicate) {
        if (window.confirm('Similar document already exists. Upload anyway?')) {
          formData.append('force', 'true');
          setUploadLoading(true);
          try {
            await axios.post(`${API}/evidence/upload`, formData, {
              headers: { ...headers, 'Content-Type': 'multipart/form-data' }
            });
            setUploadSuccess('Document uploaded successfully!');
            setUploadForm({ obligationCode: '', documentType: '', documentName: '', issueDate: '', expiryDate: '', notes: '', file: null });
            setShowUpload(false);
            fetchData();
          } catch (retryErr: any) {
            setUploadError(retryErr.response?.data?.error || 'Upload failed');
          }
        } else {
          // Declining the prompt is a decision, not a silent no-op - say what happened.
          setUploadError('Upload cancelled. A similar document already exists, so nothing was saved.');
        }
      } else {
        setUploadError(err.response?.data?.error || 'Upload failed');
      }
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await axios.delete(`${API}/evidence/${id}`, { headers });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleVerify = async (id: string, status: string, note: string = '') => {
    try {
      if (status === 'UNDER_REVIEW') {
        await axios.post(`${API}/workflow/evidence/${id}/submit`, { note }, { headers });
        alert('Submitted for review');
      } else if (status === 'VERIFIED') {
        await axios.post(`${API}/workflow/evidence/${id}/approve`, { note }, { headers });
        alert('Evidence approved');
      } else if (status === 'REJECTED') {
        if (!note) return alert('Rejection reason required');
        await axios.post(`${API}/workflow/evidence/${id}/reject`, { reason: note }, { headers });
        alert('Evidence rejected');
      } else {
        // Fallback for older statuses
        await axios.put(`${API}/evidence/${id}/verify`, { status }, { headers });
      }
      setSelectedDoc(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Verification failed');
    }
  };

  const handleViewFile = async (id: string, documentName = 'evidence-document') => {
    try {
      const response = await axios.get(`${API}/evidence/${id}/download`, { headers, responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Unable to download this document.');
    }
  };

  const handleAnalyze = async (id: string) => {
    try {
      const response = await axios.post(`${API}/evidence/${id}/analyze`, {}, { headers });
      setSelectedDoc(response.data.data);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Document analysis failed. Please verify manually.');
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    setCorrectionLoading(true);
    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const corrections: any[] = [];
      formData.forEach((value, key) => {
        corrections.push({ field: key, value: value.toString() });
      });

      const res = await axios.put(`${API}/evidence/${selectedDoc._id}/correction`, { corrections }, { headers });
      setSelectedDoc(res.data.data);
      fetchData(); // update table
    } catch (err: any) {
      alert(err.response?.data?.error || 'Correction failed');
    } finally {
      setCorrectionLoading(false);
    }
  };

  const selectedObl = obligations.find((o: any) => o.code === uploadForm.obligationCode);
  const availableDocTypes = selectedObl?.requiredEvidenceTypes || [];


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'UPLOADED': return <span className="badge badge-green">{t('status.UPLOADED')}</span>;
      case 'MISSING': return <span className="badge badge-red">{t('status.MISSING')}</span>;
      case 'EXPIRED': return <span className="badge badge-red">{t('status.EXPIRED')}</span>;
      case 'EXPIRING_SOON': return <span className="badge badge-amber">{t('status.EXPIRING_SOON')}</span>;
      default: return <span className="badge badge-muted">{status}</span>;
    }
  };

  const getVerifBadge = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case 'VERIFIED': return <span className="badge badge-green">{t('status.VERIFIED')}</span>;
      case 'REJECTED': return <span className="badge badge-red">{t('status.REJECTED')}</span>;
      case 'PENDING':
      case 'UNVERIFIED': return <span className="badge badge-amber">{t('documents.unverified', 'Unverified')}</span>;
      case 'UNDER_REVIEW': return <span className="badge badge-blue">{t('status.UNDER_REVIEW')}</span>;
      case 'ARCHIVED': return <span className="badge badge-muted">{t('documents.archived', 'Archived')}</span>;
      default: return <span className="badge badge-muted">{status}</span>;
    }
  };

  const summary = dashboard?.summary || {};
  const requiredDocs = dashboard?.requiredDocuments || [];
  const missingDocs = requiredDocs.filter((d: any) => d.status === 'MISSING');
  const expiringDocs = requiredDocs.filter((d: any) => d.status === 'EXPIRING_SOON' || d.status === 'EXPIRED');
  const canReview = user?.role === 'ADMIN' || user?.role === 'COMPLIANCE_OFFICER';

  const filteredEvidence = useMemo(() => {
    return allEvidence.filter(ev => {
      const matchSearch = (ev.documentName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (ev.documentType?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (ev.obligationCode || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType ? ev.documentType === filterType : true;
      const matchVerif = filterVerification ? ev.verificationStatus === filterVerification : true;
      
      let matchExpiry = true;
      if (filterExpiry) {
        if (filterExpiry === 'EXPIRED') matchExpiry = ev.expiryStatus === 'EXPIRED';
        if (filterExpiry === 'EXPIRING_SOON') matchExpiry = ev.expiryStatus === 'EXPIRING_SOON';
        if (filterExpiry === 'VALID') matchExpiry = ev.expiryStatus === 'VALID';
      }

      return matchSearch && matchType && matchVerif && matchExpiry;
    });
  }, [allEvidence, searchQuery, filterType, filterVerification, filterExpiry]);

  if (authLoading || loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>{t('loading', 'Loading...')}</div>;
  }

  return (
    <AppLayout pageTitle={t('topbar.evidence', 'Evidence Vault')}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px' }}>
        <button className="btn btn-outline btn-sm" onClick={fetchDataQuality} disabled={dqLoading}>{dqLoading ? '...' : t('ui.audit', 'Data Quality Audit')}</button>
        <button className="btn btn-accent btn-sm" onClick={() => openUpload()}>+ {t('ui.upload', 'Upload Document')}</button>
      </div>
      
      {uploadSuccess && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--success)', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>{uploadSuccess}</div>}

          {!dashboard?.hasProfile && (
            <div className="card mb-24" style={{ borderColor: 'var(--warning)' }}>
              <p style={{ color: 'var(--warning)', fontWeight: 600 }}>⚠️ Complete your business profile first to see required documents.</p>
              <button className="btn btn-accent btn-sm mt-16" onClick={() => navigate('/onboarding')}>Complete Profile →</button>
            </div>
          )}

          {/* Summary Cards */}
          <div className="metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card metric-card">
              <div className="card-title">{t('metrics.total_required', 'Total Required')}</div>
              <div className="metric-value" style={{ color: 'var(--text-primary)' }}>{summary.totalRequired || 0}</div>
            </div>
            <div className="card metric-card">
              <div className="card-title">{t('metrics.total_documents', 'Total Documents')}</div>
              <div className="metric-value" style={{ color: 'var(--text-primary)' }}>{allEvidence.length}</div>
            </div>
            <div className="card metric-card">
              <div className="card-title">{t('status.VERIFIED', 'Verified')}</div>
              <div className="metric-value" style={{ color: 'var(--success)' }}>{allEvidence.filter(e => e.verificationStatus === 'VERIFIED').length}</div>
            </div>
            <div className="card metric-card">
              <div className="card-title">{t('status.UNDER_REVIEW', 'Under Review')}</div>
              <div className="metric-value" style={{ color: 'var(--accent)' }}>{allEvidence.filter(e => e.verificationStatus === 'UNDER_REVIEW').length}</div>
            </div>
            <div className="card metric-card">
              <div className="card-title">{t('status.REJECTED', 'Rejected')}</div>
              <div className="metric-value" style={{ color: 'var(--danger)' }}>{allEvidence.filter(e => e.verificationStatus === 'REJECTED').length}</div>
            </div>
            <div className="card metric-card">
              <div className="card-title">{t('status.MISSING', 'Missing')}</div>
              <div className="metric-value" style={{ color: 'var(--danger)' }}>{summary.missing || 0}</div>
            </div>
            <div className="card metric-card">
              <div className="card-title">{t('metrics.expiring_expired', 'Expiring / Expired')}</div>
              <div className="metric-value" style={{ color: 'var(--warning)' }}>{(summary.expiringSoon || 0) + (summary.expired || 0)}</div>
            </div>
          </div>

          {/* Missing Documents Alert */}
          {missingDocs.length > 0 && (
            <div className="card mb-24" style={{ borderLeft: '3px solid var(--danger)' }}>
              <h3 style={{ marginBottom: '12px', color: 'var(--danger)' }}>⚠ Missing Documents ({missingDocs.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {missingDocs.map((doc: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{doc.documentType}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Required for: {doc.obligationTitle}</div>
                    </div>
                    <button className="btn btn-accent btn-sm" onClick={() => openUpload({ obligationCode: doc.obligationCode, documentType: doc.documentType, documentName: doc.documentType })}>{t('ui.upload')}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiring Documents */}
          {expiringDocs.length > 0 && (
            <div className="card mb-24" style={{ borderLeft: '3px solid var(--warning)' }}>
              <h3 style={{ marginBottom: '12px', color: 'var(--warning)' }}>⏰ Expiring / Expired ({expiringDocs.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {expiringDocs.map((doc: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{doc.documentType}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Expires: {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Required Documents Table */}
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>All Required Documents</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Obligation</th>
                    <th>Status</th>
                    <th>Verification</th>
                    <th>Expiry</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requiredDocs.map((doc: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{doc.documentType}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{doc.obligationTitle}</div>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{doc.obligationCode}</div>
                      </td>
                      <td>{getStatusBadge(doc.status)}</td>
                      <td>{doc.verificationStatus ? getVerifBadge(doc.verificationStatus) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '—'}</td>
                      <td>
                        {doc.status === 'MISSING' ? (
                          <button className="btn btn-accent btn-sm" onClick={() => openUpload({ obligationCode: doc.obligationCode, documentType: doc.documentType, documentName: doc.documentType })}>{t('ui.upload')}</button>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {doc.evidenceId && <button className="btn btn-outline btn-sm" onClick={() => handleViewFile(doc.evidenceId, doc.documentType)}>View</button>}
                            {doc.evidenceId && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.evidenceId)}>Delete</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {requiredDocs.length === 0 && (
                    <tr><td colSpan={6} className="empty-state">No required documents. Complete your profile to see obligations.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Uploaded Documents */}
          {allEvidence.length > 0 && (
            <div className="card mt-24">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>{t('documents.all_uploaded', 'All Uploaded Documents')} ({filteredEvidence.length})</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input type="text" className="form-input form-input-sm" placeholder={t('ui.search', 'Search...')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '150px' }} />
                  <select className="form-input form-input-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">{t('filter.all_types', 'All Types')}</option>
                    {Array.from(new Set(allEvidence.map(e => e.documentType))).map(t => <option key={t} value={t as string}>{t as string}</option>)}
                  </select>
                  <select className="form-input form-input-sm" value={filterVerification} onChange={e => setFilterVerification(e.target.value)}>
                    <option value="">{t('filter.all_status', 'All Status')}</option>
                    <option value="VERIFIED">{t('status.VERIFIED', 'Verified')}</option>
                    <option value="UNDER_REVIEW">{t('status.UNDER_REVIEW', 'Under Review')}</option>
                    <option value="UNVERIFIED">{t('status.UNVERIFIED', 'Unverified')}</option>
                    <option value="REJECTED">{t('status.REJECTED', 'Rejected')}</option>
                  </select>
                  <select className="form-input form-input-sm" value={filterExpiry} onChange={e => setFilterExpiry(e.target.value)}>
                    <option value="">{t('filter.all_expiry', 'All Expiry')}</option>
                    <option value="VALID">{t('status.VALID', 'Valid')}</option>
                    <option value="EXPIRING_SOON">{t('status.EXPIRING_SOON', 'Expiring Soon')}</option>
                    <option value="EXPIRED">{t('status.EXPIRED', 'Expired')}</option>
                  </select>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('documents.name', 'Name')}</th>
                      <th>{t('documents.type', 'Type')}</th>
                      <th>{t('documents.obligation', 'Obligation')}</th>
                      <th>{t('documents.verification', 'Verification')}</th>
                      <th>{t('documents.uploaded', 'Uploaded')}</th>
                      <th>{t('ui.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvidence.map((ev: any) => (
                      <tr key={ev._id}>
                        <td style={{ fontWeight: 500 }}>{ev.documentName}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{ev.documentType}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ev.obligationCode}</td>
                        <td>{getVerifBadge(ev.verificationStatus)}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date(ev.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setSelectedDoc(ev)}>Details</button>
                            <button className="btn btn-outline btn-sm" onClick={() => handleViewFile(ev._id, ev.originalFileName || ev.documentName)}>File</button>
                            <button className="btn btn-outline btn-sm" onClick={() => handleAnalyze(ev._id)}>Analyze</button>
                            {canReview && ['PENDING', 'UNVERIFIED', 'UNDER_REVIEW'].includes(ev.verificationStatus) && (
                              <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }} onClick={() => handleVerify(ev._id, 'VERIFIED')}>Verify</button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ev._id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {/* Upload Modal */}
      {showUpload && (
        <>
          <div className="drawer-overlay" onClick={() => setShowUpload(false)} />
          <div className="drawer">
            <div className="drawer-header">
              <h2 style={{ fontSize: '1.25rem' }}>Upload Evidence Document</h2>
              <button className="drawer-close" onClick={() => setShowUpload(false)}>✕</button>
            </div>

            {uploadError && <div className="error-box" style={{ marginBottom: '16px' }}>{uploadError}</div>}

            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">Obligation *</label>
                <select className="form-input" value={uploadForm.obligationCode} onChange={e => setUploadForm({ ...uploadForm, obligationCode: e.target.value, documentType: '', documentName: '' })}>
                  <option value="">Select obligation...</option>
                  {obligations.map((o: any) => <option key={o.code} value={o.code}>{o.code} — {o.title}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Document Type *</label>
                {availableDocTypes.length > 0 ? (
                  <select className="form-input" value={uploadForm.documentType} onChange={e => setUploadForm({ ...uploadForm, documentType: e.target.value, documentName: e.target.value })}>
                    <option value="">Select type...</option>
                    {availableDocTypes.map((dt: string) => <option key={dt} value={dt}>{dt}</option>)}
                  </select>
                ) : (
                  <input className="form-input" placeholder="e.g. License Certificate" value={uploadForm.documentType} onChange={e => setUploadForm({ ...uploadForm, documentType: e.target.value })} />
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Document Name *</label>
                <input className="form-input" placeholder="e.g. FSSAI License 2025-26" value={uploadForm.documentName} onChange={e => setUploadForm({ ...uploadForm, documentName: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">File (PDF, JPG, PNG — max 10MB) *</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-input" style={{ padding: '8px' }} onChange={e => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })} />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Issue Date</label>
                  <input type="date" className="form-input" value={uploadForm.issueDate} onChange={e => setUploadForm({ ...uploadForm, issueDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input type="date" className="form-input" value={uploadForm.expiryDate} onChange={e => setUploadForm({ ...uploadForm, expiryDate: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" placeholder="Optional notes..." value={uploadForm.notes} onChange={e => setUploadForm({ ...uploadForm, notes: e.target.value })} />
              </div>

              <button type="submit" className="btn btn-accent" style={{ width: '100%', marginTop: '8px' }} disabled={uploadLoading}>
                {uploadLoading ? 'Uploading...' : 'Upload Document'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Document Intelligence Detail Drawer */}
      {selectedDoc && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedDoc(null)} />
          <div className="drawer" style={{ width: '500px', maxWidth: '100%' }}>
            <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{selectedDoc.documentName}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Processing Status: 
                  <span style={{ fontWeight: 600, marginLeft: '6px', color: selectedDoc.processingStatus === 'FAILED' ? 'var(--danger)' : selectedDoc.processingStatus === 'OCR_NOT_CONFIGURED' ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {selectedDoc.processingStatus || 'UPLOADED'}
                  </span>
                </div>
              </div>
              <button className="drawer-close" onClick={() => setSelectedDoc(null)}>✕</button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => handleViewFile(selectedDoc._id)}>View File</button>
                
                {(user?.role === 'ACCOUNTANT' || user?.role === 'OWNER') && ['PENDING', 'UNVERIFIED', 'REJECTED'].includes(selectedDoc.verificationStatus) && (
                  <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => handleVerify(selectedDoc._id, 'UNDER_REVIEW')}>Submit for Review</button>
                )}
                
                {(user?.role === 'COMPLIANCE_OFFICER' || user?.role === 'OWNER') && selectedDoc.verificationStatus === 'UNDER_REVIEW' && (
                  <>
                    <button 
                      className="btn btn-accent" 
                      style={{ flex: 1, background: 'var(--success)' }} 
                      onClick={() => handleVerify(selectedDoc._id, 'VERIFIED', 'Looks good')}
                    >
                      Approve
                    </button>
                    <button 
                      className="btn btn-outline" 
                      style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)' }} 
                      onClick={() => {
                        const reason = window.prompt("Rejection Reason:");
                        if (reason) handleVerify(selectedDoc._id, 'REJECTED', reason);
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>

              {/* Classification Info */}
              <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
                <div className="card-title micro">Classification</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type Detected</div>
                    <div style={{ fontWeight: 500 }}>{selectedDoc.classification?.documentType || 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confidence</div>
                    <div style={{ fontWeight: 500 }}>{selectedDoc.classification?.confidence ? `${(selectedDoc.classification.confidence * 100).toFixed(0)}%` : 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Missing Info Warning */}
              {selectedDoc.missingInformation && selectedDoc.missingInformation.length > 0 && (
                <div className="card" style={{ marginBottom: '24px', padding: '16px', borderLeft: '3px solid var(--warning)', background: 'var(--bg-primary)' }}>
                  <div style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: '8px' }}>Missing Information</div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {selectedDoc.missingInformation.map((m: string, i: number) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}

              {/* Extracted Fields / Corrections */}
              <div className="card" style={{ padding: '16px' }}>
                <div className="card-title micro" style={{ marginBottom: '16px' }}>Extracted Metadata & Correction</div>
                {selectedDoc.extractedFields && selectedDoc.extractedFields.length > 0 ? (
                  <form onSubmit={handleCorrectionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedDoc.extractedFields.map((field: any, i: number) => (
                      <div key={i} className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="form-label" style={{ margin: 0 }}>{field.field}</label>
                          {field.correctedValue && <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>Corrected</span>}
                        </div>
                        <input 
                          name={field.field}
                          className="form-input" 
                          defaultValue={field.correctedValue || field.value || ''} 
                          placeholder={`Extracted: ${field.value || 'None'}`}
                        />
                      </div>
                    ))}
                    <button type="submit" className="btn btn-outline" disabled={correctionLoading} style={{ marginTop: '8px' }}>
                      {correctionLoading ? 'Saving...' : 'Save Corrections'}
                    </button>
                  </form>
                ) : (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No metadata extracted automatically.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Data Quality Audit Modal */}
      {showDataQuality && (
        <>
          <div className="drawer-overlay" onClick={() => setShowDataQuality(false)} />
          <div className="drawer" style={{ width: '600px', maxWidth: '100%' }}>
            <div className="drawer-header">
              <h2 style={{ fontSize: '1.25rem' }}>{t('audit.data_quality', 'Data Quality Audit')}</h2>
              <button className="drawer-close" onClick={() => setShowDataQuality(false)}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div className="card" style={{ marginBottom: '16px', background: 'var(--bg-primary)' }}>
                <h3 style={{ margin: '0 0 4px 0' }}>{t('audit.findings', 'Findings')} ({dataQuality?.totalFindings || 0})</h3>
                {dataQuality?.findings?.length > 0 ? (
                  <>
                    <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {dataQuality.totalFindings} record{dataQuality.totalFindings === 1 ? '' : 's'} flagged across{' '}
                      {dataQuality.findings.length} check{dataQuality.findings.length === 1 ? '' : 's'}.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {dataQuality.findings.map((f: any, i: number) => (
                        <div key={f.issue || i} style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span className={`badge ${DQ_SEVERITY_BADGE[f.severity] || 'badge-muted'}`}>{f.severity}</span>
                            <strong style={{ fontSize: '0.9rem' }}>{humanizeFindingCode(f.issue)}</strong>
                            <span className="badge badge-muted">{f.count}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                            {f.description}
                          </p>
                          {Array.isArray(f.records) && f.records.length > 0 && (
                            <ul style={{ margin: '10px 0 0', paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {f.records.slice(0, 10).map((record: any, j: number) => (
                                <li key={j}>{describeFindingRecord(record)}</li>
                              ))}
                              {f.records.length > 10 && (
                                <li>…and {f.records.length - 10} more</li>
                              )}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--success)', margin: '8px 0 0' }}>{t('audit.no_issues', 'No data quality issues found.')}</p>
                )}
              </div>
              {dataQuality?.notice && (
                <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>{dataQuality.notice}</p>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default EvidenceVault;
