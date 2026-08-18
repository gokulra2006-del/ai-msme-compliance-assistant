import { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';
import { FileText, Edit3, Hourglass, CheckCircle, Search, Plus, Lightbulb, MessageSquare, ArrowRight } from 'lucide-react';
import { DEMO_DOC_DASHBOARD } from '../demoData';

const API = 'http://localhost:5000/api';

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

const DocumentPreparation = () => {
  const { obligationCode } = useParams();
  const { token, user, loading: authLoading, logout } = useContext(AuthContext);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState('');
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [draftContent, setDraftContent] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const canApprove = user?.role === 'ADMIN' || user?.role === 'COMPLIANCE_OFFICER';

  const loadPreparation = async () => {
    if (!obligationCode || !token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/document-drafts/preparation/${encodeURIComponent(obligationCode)}`, { headers });
      setData(response.data.data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 401) { logout(); navigate('/login'); return; }
      setError(err.response?.data?.error || t('documents.loadError', 'Unable to load document preparation.'));
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/document-drafts/dashboard`, { headers });
      setDashboardData(response.data.data);
      setError('');
    } catch (err: any) {
      if (err.response?.status === 401) { logout(); navigate('/login'); return; }
      console.warn('[DocumentPreparation] API unavailable, using demo data.');
      setDashboardData(DEMO_DOC_DASHBOARD);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !token) {
      navigate('/login');
      return;
    }
    if (!authLoading && token) {
      if (obligationCode) {
        loadPreparation();
      } else {
        loadDashboard();
      }
    }
  }, [authLoading, token, obligationCode]);

  const generate = async (templateKey: string) => {
    if (!obligationCode) return;
    setWorking(`generate-${templateKey}`);
    try {
      const response = await axios.post(`${API}/document-drafts`, {
        obligationCode,
        templateKey,
        changeReason
      }, { headers });
      setSelectedDraft(response.data.data);
      setDraftContent(response.data.data.content);
      setChangeReason('');
      await loadPreparation();
    } catch (err: any) {
      setError(err.response?.data?.error || t('documents.generateError', 'Unable to generate the draft.'));
    } finally {
      setWorking('');
    }
  };

  const updateDraft = async () => {
    if (!selectedDraft) return;
    setWorking('save-draft');
    try {
      const response = await axios.put(`${API}/document-drafts/${selectedDraft._id}`, {
        content: draftContent,
        changeReason
      }, { headers });
      setSelectedDraft(response.data.data);
      setDraftContent(response.data.data.content);
      setChangeReason('');
      await loadPreparation();
    } catch (err: any) {
      setError(err.response?.data?.error || t('documents.saveError', 'Unable to save the draft.'));
    } finally {
      setWorking('');
    }
  };

  const updateStatus = async (status: string) => {
    if (!selectedDraft) return;
    setWorking(`status-${status}`);
    try {
      const response = await axios.put(`${API}/document-drafts/${selectedDraft._id}/status`, { status }, { headers });
      setSelectedDraft(response.data.data);
      await loadPreparation();
    } catch (err: any) {
      setError(err.response?.data?.error || t('documents.statusError', 'Unable to update the internal review status.'));
    } finally {
      setWorking('');
    }
  };

  const downloadDraft = async (draft: any) => {
    setWorking(`download-${draft._id}`);
    try {
      const response = await axios.get(`${API}/document-drafts/${draft._id}/download`, { headers, responseType: 'blob' });
      triggerDownload(response.data, `${draft.documentType.replace(/[^a-z0-9]+/gi, '_')}_v${draft.version}.txt`);
    } catch (err) {
      setError(t('documents.downloadError', 'Unable to download the draft.'));
    } finally {
      setWorking('');
    }
  };

  const openDraft = (draft: any) => {
    setSelectedDraft(draft);
    setDraftContent(draft.content);
    setChangeReason(draft.changeReason || '');
  };

  if (authLoading || loading) {
    return <div className="page-loading">{t('loading', 'Loading…')}</div>;
  }

  if (!obligationCode) {
    if (loading) return <div className="page-loading">{t('loading', 'Loading…')}</div>;
    return (
      <AppLayout pageTitle={t('documents.title', 'Document Preparation')} fullBleed={true}>
        <div className="doc-prep-dash">
          <div className="doc-prep-dash__top">
            <div className="doc-prep-dash__header">
              <div className="doc-prep-dash__title-group">
                <h1 className="page-title">{t('documents.dashboard', 'Document Preparation Dashboard')}</h1>
              <p className="page-subtitle">Draft, manage, and prepare official documents in a few simple steps.</p>
            </div>
          </div>

          {error && <div className="error-box" role="alert">{error}</div>}
          </div>
          <div className="doc-prep-dash__scrollable">
            <section className="doc-prep-dash__main card">
              <div className="doc-prep-dash__main-header">
              <div className="doc-prep-dash__main-title-group">
                <h2 className="card-title">My Document Dashboard</h2>
                <p className="doc-prep-dash__main-sub">Track your documents across all stages of preparation.</p>
              </div>
              <div className="doc-prep-dash__main-controls">
                <div className="doc-prep-dash__search">
                  <Search size={16} />
                  <input type="text" placeholder="Search documents..." />
                </div>
                <select className="doc-prep-dash__status-select">
                  <option value="ALL">All Status</option>
                  <option value="NEEDED">Documents Needed</option>
                  <option value="DRAFT">Drafts In Progress</option>
                  <option value="REVIEW">Awaiting Review</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>
            </div>

            {/* Empty State when no documents */}
            {(!dashboardData?.actions?.length) ? (
              <div className="doc-prep-dash__empty">
                <div className="doc-prep-dash__empty-icon">
                  <div className="doc-prep-dash__empty-folder">
                    <FileText size={32} className="doc-prep-dash__empty-file" />
                    <div className="doc-prep-dash__empty-sparkles">✨</div>
                  </div>
                </div>
                <h3 className="doc-prep-dash__empty-title">No documents yet</h3>
                <p className="doc-prep-dash__empty-desc">You're all set! When the Assistant identifies documents you need,<br/>they will appear here for you to prepare.</p>
                <button className="btn btn-accent doc-prep-dash__empty-btn" onClick={() => navigate('/obligations')}>
                  <Plus size={16} /> Create New Document
                </button>
                <a href="#" className="doc-prep-dash__empty-link">Learn more about document preparation &rarr;</a>
              </div>
            ) : (
              <div className="table-wrap doc-prep-dash__table-wrap">
                <table className="doc-prep-dash__table">
                  <thead><tr><th>Obligation</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {dashboardData.actions.map((action: any) => (
                      <tr key={action._id}>
                        <td>{action.title || action.ruleCode}</td>
                        <td><span className="badge badge-muted">{action.status}</span></td>
                        <td><button className="btn btn-outline btn-sm" onClick={() => navigate(`/document-preparation/${encodeURIComponent(action.ruleCode)}`)}>Prepare</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </div>


        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle={t('documents.title', 'Document Preparation')}>
      <div className="document-preparation">
        <div className="document-preparation__heading">
          <div>
            <h1 className="page-title">{t('documents.title', 'Document Preparation')}</h1>
            <p className="page-subtitle">{data?.rule?.title || obligationCode}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/obligations')}>{t('documents.backToObligations', 'Back to obligations')}</button>
        </div>

        <div className="document-review-notice" role="note">
          <strong>{t('documents.draftNotice', 'DRAFT — REQUIRES HUMAN REVIEW')}</strong>
          <span>{t('documents.draftNoticeDetail', 'Generated content is not a government form, legal certification, official filing, or proof of submission.')}</span>
        </div>

        {error && <div className="error-box" role="alert">{error}</div>}

        <section className="document-preparation__summary card">
          <div>
            <h2 className="card-title">{t('documents.preparationFor', 'Preparation for this obligation')}</h2>
            <dl className="document-details">
              <div><dt>{t('documents.obligation', 'Obligation')}</dt><dd>{data?.rule?.title || obligationCode}</dd></div>
              <div><dt>{t('documents.code', 'Code')}</dt><dd>{data?.rule?.ruleCode || obligationCode}</dd></div>
              <div><dt>{t('documents.regulator', 'Regulator')}</dt><dd>{data?.rule?.regulator || t('documents.missing', 'MISSING INFORMATION')}</dd></div>
              <div><dt>{t('documents.business', 'Business profile')}</dt><dd>{data?.profile?.some((item: any) => item.value) ? t('documents.connected', 'Connected') : t('documents.incomplete', 'Incomplete')}</dd></div>
            </dl>
          </div>
          <div className="document-official-template">
            <strong>{t('documents.officialTemplate', 'Official template')}</strong>
            <p>{data?.officialTemplateNotice || t('documents.officialUnavailable', 'Official form/template not available in the verified source database.')}</p>
            <span>{t('documents.internalOnly', 'Only non-official internal preparation drafts are available here.')}</span>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">{t('documents.informationStatus', 'Information status')}</h2>
          <div className="document-checklist">
            {data?.profile?.map((item: any) => (
              <div className={`document-checklist__row ${item.value ? 'is-available' : 'is-missing'}`} key={item.key}>
                <span aria-hidden="true">{item.value ? '✓' : '!'}</span>
                <div><strong>{item.label}</strong><small>{item.value || t('documents.missingInformation', 'MISSING INFORMATION')}</small></div>
                <em>{item.source === 'USER_ENTERED' ? t('documents.userEntered', 'User-entered data') : t('documents.verifiedData', 'Verified data')}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">{t('documents.supportingEvidence', 'Required documents and verified evidence')}</h2>
          {data?.evidenceChecklist?.length ? (
            <div className="document-checklist">
              {data.evidenceChecklist.map((item: any) => (
                <div className={`document-checklist__row ${item.satisfied ? 'is-available' : 'is-missing'}`} key={item.documentType}>
                  <span aria-hidden="true">{item.satisfied ? '✓' : '!'}</span>
                  <div>
                    <strong>{item.documentType}</strong>
                    <small>
                      {item.satisfied
                        ? item.documentName
                        : item.suggestedEvidence
                          ? t('evidence.possibleMatchNeedsLink', 'A similar document exists but is not linked to this obligation')
                          : t('documents.notVerified', 'No verified evidence linked')}
                    </small>
                  </div>
                  <em>{item.status}</em>
                </div>
              ))}
            </div>
          ) : <p className="empty-state">{data?.noEvidenceRequirementNotice || t('documents.noEvidenceRequired', 'No required evidence is configured for this obligation.')}</p>}
          <p className="form-hint">{data?.verificationMeaning}</p>
        </section>

        <section>
          <h2 className="card-title">{t('documents.availableDrafts', 'Available internal preparation drafts')}</h2>
          <div className="document-template-grid">
            {data?.templates?.map((template: any) => (
              <article className="document-template card" key={template.key}>
                <h3>{template.label}</h3>
                <p>{template.description}</p>
                {template.status === 'MISSING_INFORMATION' ? (
                  <div className="document-template__missing">
                    <strong>{t('documents.missingInformation', 'MISSING INFORMATION')}</strong>
                    <span>{template.missingInformation.map((item: any) => item.label).join(', ')}</span>
                  </div>
                ) : <div className="document-template__ready">{t('documents.readyToGenerate', 'READY TO GENERATE')}</div>}
                <button
                  className={template.status === 'READY_TO_GENERATE' ? 'btn btn-accent' : 'btn btn-outline'}
                  disabled={template.status !== 'READY_TO_GENERATE' || working === `generate-${template.key}`}
                  onClick={() => generate(template.key)}
                >
                  {working === `generate-${template.key}` ? t('documents.generating', 'Generating…') : t('documents.generateDraft', 'Generate draft')}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">{t('documents.versionHistory', 'Generated drafts and version history')}</h2>
          {data?.drafts?.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('documents.document', 'Document')}</th><th>{t('documents.version', 'Version')}</th><th>{t('documents.status', 'Status')}</th><th>{t('documents.generated', 'Generated')}</th><th>{t('documents.actions', 'Actions')}</th></tr></thead>
                <tbody>
                  {data.drafts.map((draft: any) => (
                    <tr key={draft._id}>
                      <td><strong>{draft.documentType}</strong>{draft.isCurrent && <small className="document-current">{t('documents.current', 'CURRENT')}</small>}</td>
                      <td>v{draft.version}</td>
                      <td><span className="badge badge-muted">{draft.documentStatus}</span></td>
                      <td>{new Date(draft.createdAt).toLocaleDateString()}</td>
                      <td><div className="document-actions"><button className="btn btn-outline btn-sm" onClick={() => openDraft(draft)}>{t('documents.review', 'Review')}</button><button className="btn btn-outline btn-sm" onClick={() => downloadDraft(draft)} disabled={working === `download-${draft._id}`}>{t('documents.download', 'Download')}</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty-state">{t('documents.noDrafts', 'No draft has been generated for this obligation yet.')}</p>}
        </section>
      </div>

      {selectedDraft && (
        <div className="document-draft-panel" role="dialog" aria-modal="true" aria-label={t('documents.reviewDraft', 'Review draft')}>
          <div className="drawer-overlay" onClick={() => setSelectedDraft(null)} />
          <section className="drawer document-draft-panel__drawer">
            <div className="drawer-header"><div><h2>{selectedDraft.documentType} v{selectedDraft.version}</h2><p>{selectedDraft.documentStatus}</p></div><button className="drawer-close" aria-label={t('ui.close', 'Close')} onClick={() => setSelectedDraft(null)}>×</button></div>
            <div className="document-draft-panel__body">
              <div className="document-review-notice"><strong>{t('documents.draftNotice', 'DRAFT — REQUIRES HUMAN REVIEW')}</strong></div>
              <label className="form-label" htmlFor="draft-content">{t('documents.draftContent', 'Draft content')}</label>
              <textarea id="draft-content" className="form-input document-draft-editor" value={draftContent} onChange={event => setDraftContent(event.target.value)} />
              <label className="form-label" htmlFor="change-reason">{t('documents.changeReason', 'Change note')}</label>
              <input id="change-reason" className="form-input" value={changeReason} onChange={event => setChangeReason(event.target.value)} placeholder={t('documents.changeReasonPlaceholder', 'Describe the internal change, if relevant')} />
              <div className="document-actions document-draft-panel__actions">
                <button className="btn btn-outline" onClick={updateDraft} disabled={working === 'save-draft'}>{working === 'save-draft' ? t('documents.saving', 'Saving…') : t('documents.saveDraft', 'Save draft')}</button>
                <button className="btn btn-outline" onClick={() => downloadDraft(selectedDraft)}>{t('documents.download', 'Download')}</button>
                {canApprove && <button className="btn btn-accent" onClick={() => updateStatus('APPROVED')} disabled={working === 'status-APPROVED'}>{t('documents.approveInternally', 'Approve internally')}</button>}
              </div>
              <p className="document-draft-panel__warning">{t('documents.internalApprovalWarning', 'Internal approval is not government approval and does not submit this document anywhere.')}</p>
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  );
};

export default DocumentPreparation;
