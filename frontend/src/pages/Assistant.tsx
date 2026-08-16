import { useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import AppLayout from '../components/AppLayout';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  businessMeaning?: string;
  recommendedAction?: string;
  sources?: any[];
  error?: boolean;
}

const Assistant = () => {
  const { token, user, loading: authLoading, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !token) navigate('/login');
  }, [authLoading, token, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (question: string) => {
    if (!question.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await axios.post(
        'http://localhost:5000/api/assistant/chat',
        { question, language }, // Inject language preference here
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiData = res.data.data;
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        content: aiData.answer,
        businessMeaning: aiData.businessMeaning,
        recommendedAction: aiData.recommendedAction,
        sources: aiData.sources
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        content: err.response?.data?.error || 'The compliance assistant is temporarily unavailable. You can still use your compliance dashboard, obligations and calendar.',
        error: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  if (authLoading || !token) return null;

  const suggestedQuestions = [
    "Which compliance obligations apply to my business?",
    "Why does EPF compliance apply to me?",
    "Which documents are missing?",
    "What compliance deadlines are coming up?",
    "Why is my compliance risk score high?",
    "What should I do first?",
    "Which certificates are expiring soon?",
    "Explain this compliance requirement in simple language."
  ];

  return (
    <AppLayout pageTitle={t('topbar.assistant')}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>


        {/* DISCLAIMER */}
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderBottom: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px 24px', fontSize: '0.85rem', color: 'var(--warning)', textAlign: 'center' }}>
          <strong>{t('ai.disclaimer')}</strong>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {messages.length === 0 && (
            <div className="fade-in" style={{ margin: 'auto', maxWidth: '600px', width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🤖</div>
              <h2 style={{ marginBottom: '8px' }}>{t('ai.welcome')}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                {t('ai.subtitle')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'left' }}>
                {suggestedQuestions.map((q, i) => (
                  <button 
                    key={i} 
                    className="btn btn-outline" 
                    style={{ whiteSpace: 'normal', height: 'auto', padding: '12px', textAlign: 'left', fontSize: '0.85rem', justifyContent: 'flex-start' }}
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ 
                maxWidth: '75%', 
                background: msg.sender === 'user' ? 'var(--accent)' : (msg.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)'),
                color: msg.sender === 'user' ? '#fff' : (msg.error ? 'var(--danger)' : 'var(--text-primary)'),
                padding: '16px', 
                borderRadius: '12px',
                border: msg.sender === 'assistant' && !msg.error ? '1px solid var(--border)' : (msg.error ? '1px solid rgba(239, 68, 68, 0.3)' : 'none')
              }}>
                <div style={{ marginBottom: msg.businessMeaning || msg.recommendedAction || (msg.sources && msg.sources.length > 0) ? '16px' : '0' }}>
                  {msg.content}
                </div>

                {msg.businessMeaning && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Business Meaning</h4>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{msg.businessMeaning}</div>
                  </div>
                )}

                {msg.recommendedAction && (
                  <div style={{ marginBottom: '16px', background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--success)' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', margin: 0 }}>Recommended Action</h4>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{msg.recommendedAction}</div>
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <details style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('ai.sources')}</summary>
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {msg.sources.map((src, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderLeft: '2px solid var(--border)', paddingLeft: '8px' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{src.ruleCode}</div>
                          <div>Act: {src.act}</div>
                          <div>Section: {src.section}</div>
                          {src.officialUrl && <div><a href={src.officialUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}>Official Source</a></div>}
                          {src.lastVerified && <div>Last Verified: {new Date(src.lastVerified).toLocaleDateString()}</div>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '4px' }}>
                <div className="dot" style={{ animation: 'pulse 1s infinite' }} />
                <div className="dot" style={{ animation: 'pulse 1s infinite 0.2s' }} />
                <div className="dot" style={{ animation: 'pulse 1s infinite 0.4s' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
          <form 
            style={{ display: 'flex', gap: '12px' }}
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
          >
            <button 
              type="button"
              className="btn btn-outline" 
              onClick={() => setMessages([])} 
              disabled={messages.length === 0 || isTyping}
              title={t('ui.clear')}
            >
              🧹
            </button>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a compliance question based on your verified data..."
              style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: '#fff' }}
              disabled={isTyping}
            />
            <button type="submit" className="btn btn-accent" disabled={!inputValue.trim() || isTyping}>
              {t('ui.send')}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default Assistant;
