import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Beaker, FileSearch, CheckCircle, RefreshCw, Loader2, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function UpdateImpactAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t } = useLanguage();
  
  const [update, setUpdate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

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

  if (loading) {
    return <div className="p-10 text-center text-gray-400">Loading analysis...</div>;
  }

  if (!update) {
    return <div className="p-10 text-center text-gray-400">Update not found</div>;
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 h-full overflow-y-auto">
      <button onClick={() => navigate('/admin/updates')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Back to Updates
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Beaker className="w-8 h-8 text-indigo-500" />
            Impact Analysis
          </h1>
          <p className="text-gray-400 mt-2">Evaluate the deterministic impact of a regulatory change.</p>
        </div>
        
        {update.impactAnalysisStatus === 'NOT_ANALYZED' && (
          <button 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            onClick={handleAnalyze}
            disabled={analyzing || update.status !== 'VERIFIED'}
          >
            {analyzing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">{update.title}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${update.status === 'VERIFIED' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-300'}`}>
            {update.status}
          </span>
        </div>
        <p className="text-gray-400 mb-6">{update.description}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

      {update.impactAnalysisStatus === 'ANALYZED' && update.impactAnalysisResult && (
        <div className="grid md:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xl font-bold text-white border-b border-gray-700 pb-2">
              <FileSearch className="w-5 h-5 text-blue-400" />
              Affected Rules ({update.impactAnalysisResult.affectedRules.length})
            </div>
            
            {update.impactAnalysisResult.affectedRules.length === 0 ? (
              <div className="text-gray-500 italic p-4 bg-gray-800/50 rounded-lg">No existing rules match the scope of this update.</div>
            ) : (
              <div className="space-y-4">
                {update.impactAnalysisResult.affectedRules.map((rule: any, i: number) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-white">{rule.ruleCode}</h4>
                        <p className="text-sm text-gray-400">{rule.title}</p>
                      </div>
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">v{rule.version}</span>
                    </div>
                    <div className="mt-3 text-xs bg-gray-900 p-2 rounded text-gray-400 flex items-start gap-2">
                      <Info size={14} className="mt-0.5 shrink-0" />
                      <span>{rule.matchReason}</span>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => navigate('/admin/rules')} className="text-xs text-blue-400 hover:text-blue-300">
                        Propose Change →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xl font-bold text-white border-b border-gray-700 pb-2">
              <ShieldAlert className="w-5 h-5 text-orange-400" />
              Potentially Affected Businesses ({update.impactAnalysisResult.affectedBusinesses.length})
            </div>
            
            {update.impactAnalysisResult.affectedBusinesses.length === 0 ? (
              <div className="text-gray-500 italic p-4 bg-gray-800/50 rounded-lg">No businesses match the scope of this update.</div>
            ) : (
              <div className="space-y-4">
                {update.impactAnalysisResult.affectedBusinesses.map((biz: any, i: number) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">{biz.name}</h4>
                      <p className="text-xs text-gray-400">{biz.industry} • {biz.state}</p>
                    </div>
                    <div className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded border border-orange-400/20">
                      Possible Impact
                    </div>
                  </div>
                ))}
              </div>
            )}

            {update.impactAnalysisResult.evidenceImpact?.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-white mb-4">Evidence Requiring Review</h3>
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3">Business</th>
                        <th className="px-4 py-3">Document Type</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {update.impactAnalysisResult.evidenceImpact.map((ev: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-3 text-gray-300">{ev.businessName}</td>
                          <td className="px-4 py-3 text-white">{ev.documentType}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">{ev.currentStatus}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
