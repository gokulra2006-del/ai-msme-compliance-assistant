import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Newspaper, Bell, ArrowRight, Beaker, CheckCircle, Clock, ShieldAlert, FileText, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function RegulatoryUpdates() {
  const [updates, setUpdates] = useState([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [updatesRes, dashRes] = await Promise.all([
        axios.get('http://localhost:5000/api/admin/updates', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:5000/api/admin/updates/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setUpdates(updatesRes.data.data);
      setDashboard(dashRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await axios.put(`http://localhost:5000/api/admin/updates/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData(); // Refresh to update dashboard aggregates
    } catch (err) {
      console.error(err);
      alert('Failed to update status. Make sure impact analysis is done before approving.');
    }
  };

  const columns = [
    { id: 'DRAFT', label: 'Draft' },
    { id: 'UNDER_REVIEW', label: 'Under Review' },
    { id: 'VERIFIED', label: 'Verified' },
    { id: 'APPROVED', label: 'Approved' }
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 h-full overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Newspaper className="w-8 h-8 text-orange-500" />
          Regulatory Change Impact Dashboard
        </h1>
        <p className="text-gray-400 mt-2">End-to-end regulatory change lifecycle management and deterministic impact analysis.</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 p-10">Loading dashboard...</div>
      ) : (
        <>
          {/* Dashboard Aggregates */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-white">{dashboard?.counts?.TOTAL || 0}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide mt-1">Total Changes</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-orange-400">{dashboard?.counts?.UNDER_REVIEW || 0}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide mt-1">Under Review</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-indigo-400">{dashboard?.counts?.VERIFIED || 0}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide mt-1">Verified</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-blue-400">{dashboard?.impact?.totalBusinessesAffected || 0}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide mt-1">Affected Businesses</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-purple-400">{dashboard?.impact?.totalRulesAffected || 0}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide mt-1">Rules Impacted</span>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-red-400">{dashboard?.impact?.totalHighImpact || 0}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wide mt-1">High-Risk Changes</span>
            </div>
          </div>

          {/* Upcoming Effective Changes */}
          {dashboard?.upcoming && dashboard.upcoming.length > 0 && (
            <div className="bg-indigo-900/20 border border-indigo-900/50 rounded-xl p-6">
              <h2 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" /> Upcoming Effective Changes
              </h2>
              <div className="space-y-3">
                {dashboard.upcoming.map((u: any) => (
                  <div key={u._id} className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">{u.title}</h4>
                      <p className="text-xs text-gray-400">
                        Affects {u.affectedRulesCount} rules and {u.affectedBusinessesCount} businesses.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-indigo-300 font-bold text-sm">{u.daysRemaining} days remaining</span>
                      <span className="block text-gray-500 text-xs">Effective: {new Date(u.effectiveDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Change Lifecycle Kanban */}
          <h2 className="text-xl font-bold text-white mt-8 mb-4">Change Lifecycle</h2>
          <div className="flex gap-6 overflow-x-auto pb-4 h-[600px]">
            {columns.map(col => (
              <div key={col.id} className="flex-1 min-w-[300px] max-w-[350px] bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700 bg-gray-800/80 rounded-t-xl flex justify-between items-center">
                  <h3 className="font-semibold text-gray-200">{col.label}</h3>
                  <span className="bg-gray-700 text-gray-300 text-xs py-1 px-2.5 rounded-full font-medium">
                    {updates.filter((u: any) => u.status === col.id).length}
                  </span>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-4">
                  {updates.filter((u: any) => u.status === col.id).map((update: any) => (
                    <div key={update._id} className="bg-gray-800 border border-gray-700 p-4 rounded-lg shadow-sm hover:border-gray-500 transition-colors group cursor-pointer flex flex-col h-full">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-white leading-tight">{update.title}</h4>
                        {update.status === 'DRAFT' && (
                          <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-3 mb-4 flex-1">{update.description}</p>
                      
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-700">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <FileText size={12} /> {new Date(update.createdAt).toLocaleDateString()}
                        </span>
                        
                        {/* Workflow Actions */}
                        <div className="flex items-center gap-2">
                          {col.id === 'DRAFT' && (
                            <button onClick={() => updateStatus(update._id, 'UNDER_REVIEW')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                              Review <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {col.id === 'UNDER_REVIEW' && (
                            <button onClick={() => updateStatus(update._id, 'VERIFIED')} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                              Verify <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {col.id === 'VERIFIED' && (
                            <>
                              <button onClick={() => navigate(`/admin/updates/${update._id}/impact`)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                <Beaker className="w-3 h-3" /> Analyze Impact
                              </button>
                              {/* Approve is handled inside Impact Analysis */}
                            </>
                          )}
                          {col.id === 'APPROVED' && (
                            <button onClick={() => updateStatus(update._id, 'EFFECTIVE')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                              Mark Effective <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
