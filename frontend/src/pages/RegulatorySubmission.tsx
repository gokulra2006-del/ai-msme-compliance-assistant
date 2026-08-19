import { useContext, useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';
import { AlertTriangle, ExternalLink } from 'lucide-react';

const API = 'http://localhost:5000/api';

const RegulatorySubmission = () => {
  const { actionId } = useParams();
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [action, setAction] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>({});
  const [dynamicStatus, setDynamicStatus] = useState<string>('NOT_STARTED');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');
  const [ackNum, setAckNum] = useState('');
  const [ackDate, setAckDate] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [showRecordModal, setShowRecordModal] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadSubmission = async () => {
    if (!actionId || !token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/submissions/${actionId}`, { headers });
      setData(response.data.data);
      if (response.data.action) setAction(response.data.action);
      if (response.data.checklist) setChecklist(response.data.checklist);
      if (response.data.dynamicStatus) setDynamicStatus(response.data.dynamicStatus);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 401) { navigate('/login'); return; }
      setError(err.response?.data?.error || t('submissions.loadError', 'Unable to load submission.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !token) navigate('/login');
    if (!authLoading && token && actionId) loadSubmission();
  }, [authLoading, token, actionId]);

  const startSubmission = async () => {
    setWorking('start');
    try {
      await axios.post(`${API}/submissions/${actionId}/start`, {}, { headers });
      await loadSubmission();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to start submission.');
    } finally {
      setWorking('');
    }
  };

  const markReady = async () => {
    if (!data) return;
    setWorking('ready');
    try {
      await axios.put(`${API}/submissions/${data._id}/ready`, {}, { headers });
      await loadSubmission();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to mark ready.');
    } finally {
      setWorking('');
    }
  };

  const recordSubmission = async (e: any) => {
    e.preventDefault();
    setWorking('record');
    try {
      await axios.post(`${API}/submissions/${data._id}/external-submit`, {
        acknowledgementNumber: ackNum,
        submissionDate: ackDate,
        notes
      }, { headers });
      setShowRecordModal(false);
      await loadSubmission();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to record submission.');
    } finally {
      setWorking('');
    }
  };

  const attachAcknowledgement = async () => {
    if (!evidenceId) return alert('Please enter an Evidence ID');
    setWorking('attach');
    try {
      await axios.post(`${API}/submissions/${data._id}/acknowledge`, { evidenceId }, { headers });
      await loadSubmission();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to attach acknowledgement.');
    } finally {
      setWorking('');
    }
  };

  if (authLoading || loading) return <div className="page-loading">{t('loading', 'Loading…')}</div>;

  return (
    <AppLayout pageTitle="Regulatory Submission">
      <div className="regulatory-submission">
        <div className="document-preparation__heading" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h1 className="page-title">{t('submissions.title', 'Regulatory Submission Assistance')}</h1>
            <p className="page-subtitle">{action?.title || data?.obligation?.title || 'Loading...'}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>{t("ui.back", "Back")}</button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {!data ? (
          <section className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <h2>{t('submissions.notStarted', 'Submission Not Started')}</h2>
            <p>{t('submissions.notStartedDesc', 'Click below to initialize the preparation workflow for this compliance requirement.')}</p>
            <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={startSubmission} disabled={working === 'start'}>
              {working === 'start' ? 'Starting...' : t('submissions.startBtn', 'Start Submission Guide')}
            </button>
          </section>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
            {/* Main Column */}
            <div>
              <section className="card">
                <h2 className="card-title">Submission Details</h2>
                <div className="document-details">
                  <div><dt>{t('obl.authority', 'Authority')}</dt><dd>{data.authority || 'INFORMATION UNAVAILABLE'}</dd></div>
                  <div><dt>Status</dt><dd><span className="badge badge-accent">{data.submissionStatus}</span></dd></div>
                  <div><dt>Official Portal</dt><dd>
                    {data.officialPortalUrl ? (
                      <a href={data.officialPortalUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {data.officialPortalUrl} <ExternalLink size={14} />
                      </a>
                    ) : 'NOT VERIFIED'}
                  </dd></div>
                </div>
                
                {data.officialPortalUrl && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid var(--warning)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: '13px' }}>
                        <strong>IMPORTANT:</strong> You are leaving SurakshaSetu AI and opening an external government website. 
                        SurakshaSetu will NOT capture your government passwords, OTPs, or automatically submit forms. 
                        You must complete the submission manually on the official portal.
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="card" style={{ marginTop: '24px' }}>
                <h2 className="card-title">Submission Readiness</h2>
                <div className="document-checklist">
                  <div className={`document-checklist__row ${checklist.businessInfoComplete ? 'is-available' : 'is-missing'}`}>
                    <span aria-hidden="true">{checklist.businessInfoComplete ? '✓' : '!'}</span>
                    <div><strong>Business Profile</strong><small>Information complete</small></div>
                  </div>
                  <div className={`document-checklist__row ${checklist.hasPreparedDrafts ? 'is-available' : 'is-missing'}`}>
                    <span aria-hidden="true">{checklist.hasPreparedDrafts ? '✓' : '!'}</span>
                    <div><strong>Document Preparation</strong><small>Required drafts generated</small></div>
                  </div>
                  <div className={`document-checklist__row ${checklist.allEvidenceVerified ? 'is-available' : 'is-missing'}`}>
                    <span aria-hidden="true">{checklist.allEvidenceVerified ? '✓' : '!'}</span>
                    <div><strong>Evidence Verification</strong><small>All required evidence uploaded and verified</small></div>
                  </div>
                  <div className={`document-checklist__row ${checklist.officialPortalVerified ? 'is-available' : 'is-missing'}`}>
                    <span aria-hidden="true">{checklist.officialPortalVerified ? '✓' : '!'}</span>
                    <div><strong>Official Portal</strong><small>Verified official URL available</small></div>
                  </div>
                </div>
                
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Calculated Readiness</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: dynamicStatus === 'READY_FOR_SUBMISSION' ? 'var(--success)' : 'var(--danger)' }}>
                      {dynamicStatus.replace(/_/g, ' ')}
                    </div>
                  </div>
                  
                  {data.submissionStatus === 'NOT_STARTED' || data.submissionStatus === 'DOCUMENTS_MISSING' ? (
                    <button 
                      className="btn btn-accent" 
                      disabled={dynamicStatus !== 'READY_FOR_SUBMISSION' || working === 'ready'}
                      onClick={markReady}
                    >
                      {working === 'ready' ? 'Updating...' : 'Mark Ready for Submission'}
                    </button>
                  ) : data.submissionStatus === 'READY_FOR_SUBMISSION' ? (
                    <button 
                      className="btn btn-primary" 
                      onClick={() => setShowRecordModal(true)}
                    >
                      Record External Submission
                    </button>
                  ) : data.submissionStatus === 'SUBMITTED_BY_USER' ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        placeholder="Evidence ID..." 
                        className="input input-sm" 
                        value={evidenceId}
                        onChange={(e) => setEvidenceId(e.target.value)} 
                      />
                      <button 
                        className="btn btn-accent btn-sm" 
                        disabled={working === 'attach'}
                        onClick={attachAcknowledgement}
                      >
                        {working === 'attach' ? '...' : 'Attach Acknowledgement'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>Submission Completed</div>
                  )}
                </div>
              </section>
            </div>

            {/* Side Column */}
            <div>
              <section className="card">
                <h2 className="card-title">Step-by-Step Guide</h2>
                <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <li>Review business information</li>
                  <li>Verify required documents</li>
                  <li>Generate required drafts</li>
                  <li>Open official government portal</li>
                  <li>Log in using authorized credentials</li>
                  <li>Select appropriate service</li>
                  <li>Enter required information</li>
                  <li>Upload required documents</li>
                  <li>Submit through the official portal</li>
                  <li>Save the acknowledgement number</li>
                  <li>Record the submission here</li>
                </ol>
              </section>

              {data.timeline && data.timeline.length > 0 && (
                <section className="card" style={{ marginTop: '24px' }}>
                  <h2 className="card-title">Timeline</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {data.timeline.map((event: any, idx: number) => (
                      <div key={idx} style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid var(--border)' }}>
                        <div style={{ position: 'absolute', left: '-6px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }}></div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(event.date).toLocaleString()}</div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{event.status.replace(/_/g, ' ')}</div>
                        {event.notes && <div style={{ fontSize: '13px', marginTop: '4px' }}>{event.notes}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {showRecordModal && (
          <div className="modal-overlay">
            <div className="modal card" style={{ maxWidth: '500px', width: '100%' }}>
              <h2>Record External Submission</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                By proceeding, you declare that you have successfully completed the submission on the official government portal.
              </p>
              
              <form onSubmit={recordSubmission}>
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Acknowledgement / Reference Number</label>
                  <input type="text" className="form-input" required value={ackNum} onChange={e => setAckNum(e.target.value)} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Submission Date</label>
                  <input type="date" className="form-input" required value={ackDate} onChange={e => setAckDate(e.target.value)} />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label className="form-label">Optional Notes</label>
                  <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)}></textarea>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowRecordModal(false)}>{t("ui.cancel", "Cancel")}</button>
                  <button type="submit" className="btn btn-primary" disabled={working === 'record'}>
                    {working === 'record' ? 'Saving...' : 'Confirm Submission'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RegulatorySubmission;
