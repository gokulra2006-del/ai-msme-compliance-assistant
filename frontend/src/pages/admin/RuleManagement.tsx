import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Plus, Edit2, History, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function RuleManagement() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/admin/rules', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRules(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, [token]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-blue-500" />
            {t('rule_management') || 'Rule Management'}
          </h1>
          <p className="text-gray-400 mt-2">Create, version, and manage compliance rules safely.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Plus className="w-4 h-4" />
          {t('create_new_rule') || 'Create New Rule'}
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">{t('rule_code') || 'Rule Code'}</th>
                <th className="p-4 font-semibold">{t('title') || 'Title'}</th>
                <th className="p-4 font-semibold">{t('version') || 'Version'}</th>
                <th className="p-4 font-semibold">{t('status') || 'Status'}</th>
                <th className="p-4 font-semibold text-right">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading rules...</td></tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <AlertCircle className="w-12 h-12 mb-4 text-gray-500 opacity-50" />
                      <p>No rules found in the database.</p>
                    </div>
                  </td>
                </tr>
              ) : rules.map((rule: any) => (
                <tr key={rule._id} className="hover:bg-gray-750 transition-colors group">
                  <td className="p-4">
                    <span className="font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                      {rule.ruleCode}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-200">{rule.title}</div>
                    <div className="text-sm text-gray-500 mt-1 line-clamp-1">{rule.description}</div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full text-xs font-semibold">
                      v{rule.version}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      rule.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                      rule.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {rule.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button className="p-2 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-600 rounded-lg transition-colors inline-flex items-center justify-center group-hover:opacity-100 opacity-50">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-blue-400 bg-gray-700/50 hover:bg-blue-500/20 rounded-lg transition-colors inline-flex items-center justify-center group-hover:opacity-100 opacity-50">
                      <History className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
