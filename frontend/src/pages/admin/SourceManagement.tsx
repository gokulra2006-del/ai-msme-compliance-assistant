import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, CheckCircle2, XCircle, Search, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function SourceManagement() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/admin/sources', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSources(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSources();
  }, [token]);

  const handleVerify = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await axios.put(`http://localhost:5000/api/admin/sources/${id}/verify`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSources(sources.map((s: any) => s._id === id ? { ...s, verificationStatus: status } : s));
    } catch (err) {
      console.error(err);
      alert('Verification failed. Is the URL missing?');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-purple-500" />
            {t('source_management') || 'Regulatory Sources'}
          </h1>
          <p className="text-gray-400 mt-2">Verify and manage authoritative legal texts and links.</p>
        </div>
        
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search sources..." 
            className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all w-full md:w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
           <div className="p-8 text-center text-gray-400 bg-gray-800 rounded-xl border border-gray-700">Loading...</div>
        ) : sources.length === 0 ? (
           <div className="p-8 text-center text-gray-400 bg-gray-800 rounded-xl border border-gray-700">No sources found.</div>
        ) : (
          sources.map((source: any) => (
            <div key={source._id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col md:flex-row gap-6 md:items-center shadow-lg hover:border-gray-600 transition-colors">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{source.sourceName}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
                    source.verificationStatus === 'VERIFIED' ? 'bg-green-500/10 text-green-400' :
                    source.verificationStatus === 'PENDING_REVIEW' ? 'bg-amber-500/10 text-amber-400' :
                    source.verificationStatus === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>
                    {source.verificationStatus.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
                  {source.regulator && <span><span className="text-gray-500">Regulator:</span> {source.regulator}</span>}
                  {source.jurisdiction && <span><span className="text-gray-500">Jurisdiction:</span> {source.jurisdiction}</span>}
                </div>
                {source.officialUrl && (
                  <a href={source.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-2">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {source.officialUrl}
                  </a>
                )}
              </div>
              
              <div className="flex gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-gray-700">
                <button 
                  onClick={() => handleVerify(source._id, 'VERIFIED')}
                  disabled={source.verificationStatus === 'VERIFIED'}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Verify
                </button>
                <button 
                  onClick={() => handleVerify(source._id, 'REJECTED')}
                  disabled={source.verificationStatus === 'REJECTED'}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
