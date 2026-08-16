import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';
import { CheckCircle2, Circle, ExternalLink, Upload, AlertCircle } from 'lucide-react';

export default function SubmissionGuide() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  const { t } = useLanguage();
  
  const [action, setAction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [checklist, setChecklist] = useState({
    prereqChecked: false,
    docsChecked: false,
    deadlineChecked: false
  });
  
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchAction = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/compliance-actions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const found = res.data.data.find((a: any) => a._id === id);
        if (found) {
          setAction(found);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchAction();
  }, [id, token]);

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      await axios.post(`http://localhost:5000/api/compliance-actions/${id}/submit-record`, {
        status: 'SUBMITTED',
        referenceNumber
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Also mark internal task as completed
      await axios.put(`http://localhost:5000/api/compliance-actions/${id}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <AppLayout><div style={{ padding: 40 }}>Loading guide...</div></AppLayout>;
  if (!action) return <AppLayout><div style={{ padding: 40 }}>Action not found.</div></AppLayout>;

  // Simulate portal URL. In a full DB, this comes from action.obligationId.regulatorySource.officialUrl
  // For the prototype rules, we just show missing if there isn't one
  const portalUrl = action.obligationId?.regulatorySource?.officialUrl || null;
  const isReadyToSubmit = checklist.prereqChecked && checklist.docsChecked && checklist.deadlineChecked;

  return (
    <AppLayout pageTitle="Submission Guide">
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 0' }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>← Back</button>
        
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 8px' }}>{action.title}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{action.description}</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Authority</div>
              <div style={{ fontWeight: 500 }}>{action.category}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deadline</div>
              <div style={{ fontWeight: 500, color: 'var(--error)' }}>{action.dueDate ? new Date(action.dueDate).toLocaleDateString() : 'N/A'}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Step 1: Preparation Checklist</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => toggleCheck('prereqChecked')}>
              {checklist.prereqChecked ? <CheckCircle2 color="var(--success)" /> : <Circle color="var(--border)" />}
              <span>I have verified all business information is up to date</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => toggleCheck('docsChecked')}>
              {checklist.docsChecked ? <CheckCircle2 color="var(--success)" /> : <Circle color="var(--border)" />}
              <span>I have gathered all required evidence documents</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => toggleCheck('deadlineChecked')}>
              {checklist.deadlineChecked ? <CheckCircle2 color="var(--success)" /> : <Circle color="var(--border)" />}
              <span>I have checked the current filing period deadline</span>
            </div>
          </div>
          
          <div style={{ marginTop: 24 }}>
            <h4 style={{ margin: '0 0 8px' }}>Required Documents</h4>
            {action.evidenceRequired && action.evidenceRequired.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {action.evidenceRequired.map((doc: string, i: number) => (
                  <li key={i}>{doc}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>No specific documents required for upload.</p>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Step 2: Official Portal Submission</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>You must perform the actual submission on the official government portal. This tool does not submit data on your behalf.</p>
          
          {portalUrl ? (
            <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Official Government Portal</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{portalUrl}</div>
              </div>
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Open Portal <ExternalLink size={16} />
              </a>
            </div>
          ) : (
            <div style={{ padding: 16, border: '1px solid var(--warning)', borderRadius: 8, background: 'rgba(255, 170, 0, 0.1)', display: 'flex', gap: 12 }}>
              <AlertCircle color="var(--warning)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#b06000' }}>Portal Not Verified</div>
                <div style={{ fontSize: 14 }}>We do not have a verified official portal URL for this specific rule. Please manually locate the appropriate government website.</div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 16px' }}>Step 3: Record Submission</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>After completing your submission on the government portal, enter your acknowledgement details here.</p>
          
          <div className="form-group">
            <label className="form-label">Acknowledgement / Reference Number (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. ACK-2026-99182"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              disabled={!isReadyToSubmit}
            />
          </div>
          
          <div style={{ padding: 16, border: '1px dashed var(--border)', borderRadius: 8, textAlign: 'center', marginTop: 16, opacity: isReadyToSubmit ? 1 : 0.5 }}>
            <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <div style={{ fontWeight: 500 }}>Upload Acknowledgement Receipt</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>(Attach to evidence vault)</div>
          </div>
          
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end' }}>
            <button 
              className="btn btn-primary" 
              disabled={!isReadyToSubmit || submitting}
              onClick={handleFinalSubmit}
            >
              {submitting ? 'Recording...' : 'Mark as Submitted to Government'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Marking this task complete records the internal status, but does not submit anything to the government portal.
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
