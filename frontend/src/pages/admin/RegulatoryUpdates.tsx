import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Newspaper, Bell, ArrowRight, Beaker } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function RegulatoryUpdates() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/admin/updates', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUpdates(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUpdates();
  }, [token]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await axios.put(`http://localhost:5000/api/admin/updates/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUpdates(updates.map((u: any) => u._id === id ? { ...u, status } : u));
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  const columns = [
    { id: 'RECEIVED', label: 'Received' },
    { id: 'UNDER_REVIEW', label: 'Under Review' },
    { id: 'VERIFIED', label: 'Verified' },
    { id: 'PUBLISHED', label: 'Published' }
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Newspaper className="w-8 h-8 text-orange-500" />
            {t('regulatory_updates') || 'Regulatory Updates'}
          </h1>
          <p className="text-gray-400 mt-2">Track and process newly received regulatory notifications.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 p-10">Loading pipeline...</div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
          {columns.map(col => (
            <div key={col.id} className="flex-1 min-w-[300px] bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700 bg-gray-800/80 rounded-t-xl flex justify-between items-center">
                <h3 className="font-semibold text-gray-200">{col.label}</h3>
                <span className="bg-gray-700 text-gray-300 text-xs py-1 px-2.5 rounded-full font-medium">
                  {updates.filter((u: any) => u.status === col.id).length}
                </span>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {updates.filter((u: any) => u.status === col.id).map((update: any) => (
                  <div key={update._id} className="bg-gray-800 border border-gray-700 p-4 rounded-lg shadow-sm hover:border-gray-500 transition-colors group cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-white leading-tight">{update.title}</h4>
                      {update.status === 'RECEIVED' && (
                        <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-4">{update.description}</p>
                    
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-gray-500">
                        {new Date(update.receivedDate).toLocaleDateString()}
                      </span>
                      
                      {/* Workflow Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                        {col.id === 'RECEIVED' && (
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
                              <Beaker className="w-3 h-3" /> Impact
                            </button>
                            <button onClick={() => updateStatus(update._id, 'PUBLISHED')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 ml-2">
                              Publish <ArrowRight className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
