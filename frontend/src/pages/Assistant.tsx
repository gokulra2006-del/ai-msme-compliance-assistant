import { useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';
import { Mic, MicOff, Volume2, Square, AlertCircle, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  businessMeaning?: string;
  recommendedAction?: string;
  sources?: any[];
  error?: boolean;
  actionType?: string;
  actionTarget?: string;
}

// BCP-47 language codes mapping for Speech Recognition and TTS
const getBcp47Code = (langCode: string) => {
  const map: Record<string, string> = {
    'en': 'en-US',
    'hi': 'hi-IN',
    'ta': 'ta-IN',
    'te': 'te-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
    'mr': 'mr-IN',
    'bn': 'bn-IN',
    'gu': 'gu-IN',
    'pa': 'pa-IN',
    'ur': 'ur-IN'
  };
  return map[langCode] || 'en-US';
};

const Assistant = () => {
  const { token, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (!authLoading && !token) navigate('/login');
  }, [authLoading, token, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, voiceError, isListening]);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setVoiceError('');
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');
        setInputValue(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone permission denied. You can type your question instead.');
        } else if (event.error !== 'aborted') {
          setVoiceError('Speech recognition failed: ' + event.error);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      setVoiceError('Voice input is not supported by this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.lang = getBcp47Code(language);
      recognitionRef.current.start();
    }
  };

  const handleSend = async (question: string) => {
    if (!question.trim()) return;

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setVoiceError('');

    try {
      const res = await axios.post(
        'http://localhost:5000/api/assistant/chat',
        { question, language },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiData = res.data.data;
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        content: aiData.answer,
        businessMeaning: aiData.businessMeaning,
        recommendedAction: aiData.recommendedAction,
        sources: aiData.sources,
        actionType: aiData.actionType,
        actionTarget: aiData.actionTarget
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

  const toggleSpeak = (msg: ChatMessage) => {
    if (!synthRef.current) return;

    if (isSpeakingId === msg.id) {
      synthRef.current.cancel();
      setIsSpeakingId(null);
      return;
    }

    // Cancel any ongoing speech
    synthRef.current.cancel();

    // Construct text to read
    let textToRead = msg.content;
    if (msg.businessMeaning) textToRead += ". Business Meaning: " + msg.businessMeaning;
    if (msg.recommendedAction) textToRead += ". Recommended Action: " + msg.recommendedAction;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = getBcp47Code(language);
    
    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);
    
    setIsSpeakingId(msg.id);
    synthRef.current.speak(utterance);
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
          <strong>{t('ai.disclaimer')} (Strictly bounded to GAWK deterministic rules)</strong>
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
                    className="btn btn-outline hover:border-indigo-500 hover:bg-indigo-900/20 transition-colors" 
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
                border: msg.sender === 'assistant' && !msg.error ? '1px solid var(--border)' : (msg.error ? '1px solid rgba(239, 68, 68, 0.3)' : 'none'),
                position: 'relative'
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

                {msg.actionType === 'PREPARE_DOCUMENT' && msg.actionTarget && (
                  <div style={{ marginBottom: '16px' }}>
                    <button 
                      className="btn btn-accent" 
                      onClick={() => navigate(`/document-preparation/${encodeURIComponent(msg.actionTarget!)}`)}
                    >
                      Prepare Document: {msg.actionTarget}
                    </button>
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <details style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
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

                {msg.sender === 'assistant' && !msg.error && (
                  <button 
                    onClick={() => toggleSpeak(msg)}
                    className="absolute -right-12 top-4 p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors"
                    title={isSpeakingId === msg.id ? "Stop reading" : "Read aloud"}
                    aria-label={isSpeakingId === msg.id ? "Stop reading" : "Read aloud"}
                  >
                    {isSpeakingId === msg.id ? <Square size={18} className="text-red-400 fill-red-400" /> : <Volume2 size={18} />}
                  </button>
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

          {voiceError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-900/50 p-3 rounded-lg mx-auto w-fit">
              <AlertCircle size={16} />
              {voiceError}
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
          <form 
            style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
          >
            <button 
              type="button"
              className="btn btn-outline p-3 rounded-full hover:bg-gray-800" 
              onClick={() => setMessages([])} 
              disabled={messages.length === 0 || isTyping}
              title={t('ui.clear')}
              aria-label="Clear chat history"
            >
              🧹
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isListening ? "Listening..." : "Ask a compliance question by typing or speaking..."}
                style={{ 
                  width: '100%', 
                  padding: '16px 24px', 
                  borderRadius: '12px', 
                  border: isListening ? '2px solid var(--accent)' : '1px solid var(--border)', 
                  background: 'var(--bg-elevated)', 
                  color: '#fff',
                  transition: 'border 0.2s'
                }}
                disabled={isTyping}
              />
              <button
                type="button"
                onClick={toggleListen}
                disabled={isTyping}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                title={isListening ? "Stop voice input" : "Start voice input"}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            </div>
            <button type="submit" className="btn btn-accent px-8" disabled={!inputValue.trim() || isTyping}>
              {isTyping ? <Loader2 size={20} className="spin" /> : t('ui.send')}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default Assistant;
