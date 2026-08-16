import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Beaker, FileSearch, CheckCircle, RefreshCw, Loader2, XCircle, AlertTriangle, Clock, Activity } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function UpdateImpactAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t } = useLanguage();
  
  const [update, setUpdate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUpdateDetails();
  }, [id, token]);

  const fetchUpdateDetails = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/admin/updates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUpdate(res.data.data);
    } catch (err) {
      console.error(err);
      alert('Failed to load update details');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await axios.post(`http://localhost:5000/api/admin/updates/${id}/analyze-impact`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUpdate(res.data.data);
    } catch (err) {
      console.error(err);
      alert('Failed to analyze impact. Make sure the update is VERIFIED.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!window.confirm(`Are you sure you want to mark this update as ${status}?`)) return;
    setProcessing(true);
    try {
      const res = await axios.put(`http://localhost:5000/api/admin/updates/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUpdate(res.data.data);
      if (status === 'APPROVED') {
        alert('Update approved successfully. Actions generated and businesses notified.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-gray-400">Loading analysis...</div>;
  }

  if (!update) {
    return <div className="p-10 text-center text-gray-400">Update not found</div>;
  }

  const result = update.impactAnalysisResult;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 h-full overflow-y-auto">
      <div className="flex justify-between items-center">
        <button onClick={() => navigate('/admin/updates')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Back to Updates
        </button>
        
        {update.status === 'VERIFIED' && update.impactAnalysisStatus === 'ANALYZED' && (
          <div className="flex gap-4">
            <button 
              className="bg-red-900/50 hover:bg-red-900 text-red-200 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-red-800"
              onClick={() => handleStatusChange('REJECTED')}
              disabled={processing}
            >
              {processing ? <Loader2 size={18} className="spin" /> : <XCircle size={18} />}
              Reject Change
            </button>
            <button 
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              onClick={() => handleStatusChange('APPROVED')}
              disabled={processing}
            >
              {processing ? <Loader2 size={18} className="spin" /> : <CheckCircle size={18} />}
              Approve Change
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Beaker className="w-8 h-8 text-indigo-500" />
            Impact Analysis Dashboard
          </h1>
          <p className="text-gray-400 mt-2">Evaluate the deterministic impact of a regulatory change before approving it.</p>
        </div>
        
        {update.status === 'VERIFIED' && update.impactAnalysisStatus !== 'ANALYZED' && (
          <button 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
            {analyzing ? 'Simulating Impact...' : 'Simulate Impact'}
          </button>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">{update.title}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            update.status === 'APPROVED' ? 'bg-green-900/50 text-green-400' : 
            update.status === 'REJECTED' ? 'bg-red-900/50 text-red-400' : 
            update.status === 'VERIFIED' ? 'bg-indigo-900/50 text-indigo-400' : 'bg-gray-700 text-gray-300'
          }`}>
            {update.status}
          </span>
        </div>
        <p className="text-gray-400 mb-6">{update.description}</p>
        
        {/* Before / After Preview */}
        {update.newRequirement && (
          <div className="mt-6 mb-8 grid grid-cols-2 gap-4">
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
              <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase">Before</h3>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(update.oldRequirement || {}, null, 2)}
              </pre>
            </div>
            <div className="bg-indigo-900/20 p-4 rounded-lg border border-indigo-900/50">
              <h3 className="text-sm font-bold text-indigo-400 mb-2 uppercase">Proposed After</h3>
              <pre className="text-xs text-indigo-200 whitespace-pre-wrap">
                {JSON.stringify(update.newRequirement, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-gray-700 pt-6">
          <div>
            <span className="block text-gray-500">Effective Date</span>
            <span className="text-gray-200">{update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div>
            <span className="block text-gray-500">Affected States</span>
            <span className="text-gray-200">{update.affectedStates?.length > 0 ? update.affectedStates.join(', ') : 'All'}</span>
          </div>
          <div>
            <span className="block text-gray-500">Affected Industries</span>
            <span className="text-gray-200">{update.affectedIndustries?.length > 0 ? update.affectedIndustries.join(', ') : 'All'}</span>
          </div>
          <div>
            <span className="block text-gray-500">Analysis Status</span>
            <span className="text-gray-200">{update.impactAnalysisStatus?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {update.impactAnalysisStatus === 'ANALYZED' && result && (
        <div className="space-y-8">
          
          {/* Summary Metrics */}
          {result.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-xs uppercase mb-1">Total Businesses</div>
                <div className="text-2xl font-bold text-white">{result.summary.totalBusinesses}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-xs uppercase mb-1">High-Risk Impacts</div>
                <div className="text-2xl font-bold text-red-400">{result.summary.totalHighRisk}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-xs uppercase mb-1">Doc Changes</div>
                <div className="text-2xl font-bold text-orange-400">{result.summary.totalDocChanges}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-xs uppercase mb-1">Deadline Changes</div>
                <div className="text-2xl font-bold text-indigo-400">{result.summary.totalDeadlineChanges}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-gray-400 text-xs uppercase mb-1">States Affected</div>
                <div className="text-2xl font-bold text-white">{result.summary.affectedStatesCount}</div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xl font-bold text-white border-b border-gray-700 pb-2">
                <FileSearch className="w-5 h-5 text-blue-400" />
                Affected Rules ({result.affectedRules.length})
              </div>
              
              {result.affectedRules.length === 0 ? (
                <div className="text-gray-500 italic p-4 bg-gray-800/50 rounded-lg">No existing rules match the scope of this update.</div>
              ) : (
                <div className="space-y-4">
                  {result.affectedRules.map((rule: any, i: number) => (
                    <div key={i} className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-white">{rule.ruleCode}</h4>
                          <p className="text-sm text-gray-400">{rule.title}</p>
                          <p className="text-xs text-indigo-400 mt-2">Source: {rule.sourceAct}</p>
                        </div>
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">v{rule.version}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xl font-bold text-white border-b border-gray-700 pb-2">
                <ShieldAlert className="w-5 h-5 text-orange-400" />
                Affected Businesses ({result.affectedBusinesses.length})
              </div>
              
              {result.affectedBusinesses.length === 0 ? (
                <div className="text-gray-500 italic p-4 bg-gray-800/50 rounded-lg">No businesses are directly impacted by this change.</div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {result.affectedBusinesses.map((biz: any, i: number) => (
                    <div key={i} className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-white">{biz.name}</h4>
                          <p className="text-xs text-gray-400">{biz.industry} • {biz.state}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${biz.riskDelta > 0 ? 'bg-red-900/50 text-red-400' : 'bg-orange-900/50 text-orange-400'}`}>
                          Risk {biz.riskDelta > 0 ? `+${biz.riskDelta}` : biz.riskDelta}
                        </span>
                      </div>
                      
                      <div className="bg-gray-900/50 rounded p-3 text-sm space-y-3">
                        <div className="flex justify-between font-medium text-xs mb-1">
                          <span className={biz.beforeStatus === 'APPLIES' ? 'text-orange-400' : 'text-gray-400'}>Before: {biz.beforeStatus}</span>
                          <span className={biz.afterStatus === 'APPLIES' ? 'text-red-400' : 'text-gray-400'}>After: {biz.afterStatus}</span>
                        </div>
                        
                        <div className="pt-2 border-t border-gray-700">
                          <span className="text-gray-400 block text-xs font-bold mb-1">IMPACT REASON:</span>
                          <span className="text-white text-sm">{biz.impactReason}</span>
                        </div>
                        
                        {biz.deadlineImpact && (
                          <div className="pt-2">
                            <span className="text-gray-400 block text-xs font-bold mb-1 flex items-center gap-1"><Clock size={12}/> DEADLINE CHANGE:</span>
                            <span className="text-indigo-300 text-sm">Was: {biz.deadlineImpact.old || 'N/A'} ➔ Now: {biz.deadlineImpact.new || 'N/A'}</span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-gray-700">
                          <span className="text-gray-400 block text-xs font-bold mb-1 flex items-center gap-1"><Activity size={12}/> REQUIRED BUSINESS ACTION:</span>
                          <ul className="list-disc pl-4 text-indigo-300 text-sm">
                            {biz.actionList?.map((action: string, idx: number) => (
                              <li key={idx}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {result.evidenceImpact?.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 text-xl font-bold text-white border-b border-gray-700 pb-2 mb-4">
                <FileSearch className="w-5 h-5 text-indigo-400" />
                Evidence Document Impact
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3">Business</th>
                      <th className="px-4 py-3">Rule</th>
                      <th className="px-4 py-3">Old Documents</th>
                      <th className="px-4 py-3">New Documents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {result.evidenceImpact.map((ev: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-gray-300">{ev.businessName}</td>
                        <td className="px-4 py-3 text-gray-400">{ev.ruleCode}</td>
                        <td className="px-4 py-3 text-orange-300 line-through">{(ev.oldDocuments || []).join(', ')}</td>
                        <td className="px-4 py-3 text-green-400">{(ev.newDocuments || []).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
