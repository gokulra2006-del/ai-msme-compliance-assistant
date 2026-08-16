import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FileSearch, Clock, ShieldAlert, ArrowRight, Loader2, Activity, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BusinessImpactSimulator() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [impacts, setImpacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusinessImpacts();
  }, [token]);

  const fetchBusinessImpacts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/business/updates/impact', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImpacts(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-400">
        <Loader2 className="w-8 h-8 spin" />
        <span className="ml-3">Loading impact simulator...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 h-full overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-indigo-500" />
          Regulatory Change Impact Simulator
        </h1>
        <p className="text-gray-400 mt-2">
          Discover exactly how verified regulatory changes affect your business obligations, documents, and risk profile.
        </p>
      </div>

      {impacts.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 p-8 rounded-xl text-center">
          <ShieldAlert className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Recent Impacts</h2>
          <p className="text-gray-400">There are currently no verified regulatory changes that affect your specific business profile.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {impacts.map((update, idx) => (
            <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-gray-900/50 p-6 border-b border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">{update.title}</h2>
                    <p className="text-sm text-gray-400 mb-4">{update.description}</p>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Source: {update.source?.actName || 'Government Gazette'}</span>
                      <span>Effective: {update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString() : 'Immediate'}</span>
                      <span className="px-2 py-0.5 bg-indigo-900/30 text-indigo-400 rounded-full">{update.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-indigo-900/10">
                <h3 className="text-sm font-bold text-indigo-400 mb-4 uppercase tracking-wider">WHY THIS CHANGE AFFECTS YOUR BUSINESS</h3>
                
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Before vs After */}
                  <div className="space-y-4">
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                      <h4 className="text-white font-medium mb-1">Affected Rule: {update.impactDetails.affectedRule}</h4>
                      <p className="text-gray-400 text-sm mb-4">{update.impactDetails.ruleName}</p>
                      
                      <div className="flex justify-between items-center text-sm mb-4">
                        <div className="text-center w-2/5">
                          <span className="block text-xs text-gray-500 uppercase mb-1">Before</span>
                          <span className={update.impactDetails.beforeStatus === 'APPLIES' ? 'text-orange-400 font-medium' : 'text-gray-400'}>{update.impactDetails.beforeStatus}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-600" />
                        <div className="text-center w-2/5">
                          <span className="block text-xs text-gray-500 uppercase mb-1">After</span>
                          <span className={update.impactDetails.afterStatus === 'APPLIES' ? 'text-red-400 font-medium' : 'text-gray-400'}>{update.impactDetails.afterStatus}</span>
                        </div>
                      </div>

                      <div className="bg-gray-800 p-3 rounded text-sm text-gray-300">
                        {update.impactDetails.impactReason}
                      </div>

                      {update.impactDetails.deadlineImpact && (
                        <div className="mt-3 flex items-start gap-2 bg-gray-800 p-3 rounded text-sm">
                          <Clock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-gray-400 text-xs uppercase mb-1">Deadline Change</span>
                            <span className="text-indigo-300">Was {update.impactDetails.deadlineImpact.old || 'N/A'} ➔ Now {update.impactDetails.deadlineImpact.new || 'N/A'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Risk */}
                  <div className="space-y-4">
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-white font-medium">Required Business Action</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${update.impactDetails.riskDelta > 0 ? 'bg-red-900/20 text-red-400' : 'bg-orange-900/20 text-orange-400'}`}>
                          Risk Impact {update.impactDetails.riskDelta > 0 ? `+${update.impactDetails.riskDelta}` : update.impactDetails.riskDelta}
                        </span>
                      </div>

                      <ul className="space-y-3">
                        {update.impactDetails.actionList?.map((action: string, i: number) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                            <div className="mt-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>

                      {update.impactDetails.docImpact && (
                        <div className="mt-6">
                          <button 
                            onClick={() => navigate(`/document-preparation/${update.impactDetails.affectedRule}`)}
                            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <FileSearch className="w-4 h-4" />
                            DOCUMENT PREPARATION REQUIRED
                          </button>
                        </div>
                      )}

                      {update.generatedActions?.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-gray-800">
                          <span className="block text-xs text-gray-500 uppercase mb-2">Pending System Actions</span>
                          {update.generatedActions.map((act: any, i: number) => (
                            <div key={i} className="flex justify-between items-center bg-gray-800 p-2 rounded text-xs">
                              <span className="text-gray-300 truncate max-w-[200px]">{act.title}</span>
                              <span className="text-indigo-400">{new Date(act.dueDate).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
