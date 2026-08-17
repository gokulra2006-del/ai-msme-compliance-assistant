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
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#f5f7f6' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 ? (
            <div className="fade-in" style={{ margin: 'auto auto 0', width: '100%', maxWidth: '780px', textAlign: 'center' }}>
              <div
                style={{
                  width: '86px',
                  height: '86px',
                  margin: '0 auto 18px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(124, 211, 197, 0.18) 0%, rgba(147, 197, 253, 0.12) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 12px 30px rgba(16, 185, 129, 0.12)',
                  padding: '14px'
                }}
              >
                <img src="/logo.svg" alt="SurakshaSetu AI logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

              <h2 style={{ margin: '0 0 10px', fontSize: '2.1rem', fontWeight: 700, color: '#1a1f36', letterSpacing: '-0.03em' }}>
                {t('ai.welcome')}
              </h2>

              <p style={{ margin: '0 auto 26px', maxWidth: '560px', color: '#5a6b7d', fontSize: '1.05rem', lineHeight: 1.55 }}>
                {t('ai.subtitle')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'left' }}>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(q)}
                    style={{
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      background: '#f4f6f5',
                      color: '#1a1f36',
                      borderRadius: '12px',
                      padding: '18px 18px',
                      fontSize: '0.98rem',
                      fontWeight: 500,
                      lineHeight: 1.5,
                      whiteSpace: 'normal',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 0 rgba(15, 23, 42, 0.02)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#edf5f3';
                      e.currentTarget.style.borderColor = 'rgba(80, 200, 168, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f4f6f5';
                      e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '900px', width: '100%', margin: '0 auto' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%',
                    background: msg.sender === 'user' ? '#5bc2a8' : (msg.error ? 'rgba(239, 68, 68, 0.08)' : '#ffffff'),
                    color: msg.sender === 'user' ? '#ffffff' : (msg.error ? '#b91c1c' : '#1a1f36'),
                    padding: '16px 18px',
                    borderRadius: '14px',
                    border: msg.sender === 'assistant' && !msg.error ? '1px solid rgba(15, 23, 42, 0.08)' : (msg.error ? '1px solid rgba(239, 68, 68, 0.25)' : 'none'),
                    position: 'relative',
                    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)'
                  }}>
                    <div style={{ marginBottom: msg.businessMeaning || msg.recommendedAction || (msg.sources && msg.sources.length > 0) ? '16px' : '0', lineHeight: 1.6 }}>
                      {msg.content}
                    </div>

                    {msg.businessMeaning && (
                      <div style={{ marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '0.8rem', color: '#5a6b7d', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Business Meaning</h4>
                        <div style={{ fontSize: '0.92rem', color: '#343f51' }}>{msg.businessMeaning}</div>
                      </div>
                    )}

                    {msg.recommendedAction && (
                      <div style={{ marginBottom: '16px', background: 'rgba(34, 197, 94, 0.08)', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid #3dc7a1' }}>
                        <h4 style={{ fontSize: '0.8rem', color: '#0c8a68', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', margin: 0 }}>Recommended Action</h4>
                        <div style={{ fontSize: '0.92rem', color: '#1a1f36' }}>{msg.recommendedAction}</div>
                      </div>
                    )}

                    {msg.actionType === 'PREPARE_DOCUMENT' && msg.actionTarget && (
                      <div style={{ marginBottom: '16px' }}>
                        <button
                          type="button"
                          style={{
                            border: 'none',
                            borderRadius: '10px',
                            background: '#57c6a6',
                            color: '#fff',
                            fontWeight: 600,
                            padding: '10px 16px',
                            cursor: 'pointer'
                          }}
                          onClick={() => navigate(`/document-preparation/${encodeURIComponent(msg.actionTarget!)}`)}
                        >
                          Prepare Document: {msg.actionTarget}
                        </button>
                      </div>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <details style={{ background: 'rgba(15, 23, 42, 0.03)', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#5a6b7d' }}>{t('ai.sources')}</summary>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {msg.sources.map((src, i) => (
                            <div key={i} style={{ fontSize: '0.8rem', color: '#5a6b7d', borderLeft: '2px solid rgba(15, 23, 42, 0.1)', paddingLeft: '8px' }}>
                              <div style={{ color: '#1a1f36', fontWeight: 600 }}>{src.ruleCode}</div>
                              <div>Act: {src.act}</div>
                              <div>Section: {src.section}</div>
                              {src.officialUrl && <div><a href={src.officialUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>Official Source</a></div>}
                              {src.lastVerified && <div>Last Verified: {new Date(src.lastVerified).toLocaleDateString()}</div>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {msg.sender === 'assistant' && !msg.error && (
                      <button
                        type="button"
                        onClick={() => toggleSpeak(msg)}
                        style={{
                          position: 'absolute',
                          right: '-12px',
                          top: '14px',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: '1px solid rgba(15, 23, 42, 0.08)',
                          background: '#fff',
                          color: '#5a6b7d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title={isSpeakingId === msg.id ? 'Stop reading' : 'Read aloud'}
                        aria-label={isSpeakingId === msg.id ? 'Stop reading' : 'Read aloud'}
                      >
                        {isSpeakingId === msg.id ? <Square size={16} className="text-red-400 fill-red-400" /> : <Volume2 size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '900px', width: '100%', margin: '18px auto 0' }}>
              <div style={{ background: '#ffffff', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(15, 23, 42, 0.08)', display: 'flex', gap: '5px', boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)' }}>
                <div className="dot" style={{ animation: 'pulse 1s infinite' }} />
                <div className="dot" style={{ animation: 'pulse 1s infinite 0.2s' }} />
                <div className="dot" style={{ animation: 'pulse 1s infinite 0.4s' }} />
              </div>
            </div>
          )}

          {voiceError && (
            <div style={{ margin: '12px auto 0', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.05)', color: '#b91c1c', fontSize: '0.9rem' }}>
              <AlertCircle size={16} />
              {voiceError}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '18px 24px 24px', background: 'rgba(255,255,255,0.15)' }}>
          <form
            style={{ display: 'flex', gap: '12px', alignItems: 'center', maxWidth: '1040px', margin: '0 auto' }}
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
          >
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '16px', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic size={18} />
              </div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isListening ? 'Listening...' : 'Type your compliance question...'}
                style={{
                  width: '100%',
                  border: isListening ? '2px solid rgba(80, 200, 168, 0.8)' : '1px solid rgba(15, 23, 42, 0.1)',
                  background: '#ffffff',
                  color: '#1a1f36',
                  borderRadius: '14px',
                  padding: '16px 130px 16px 46px',
                  fontSize: '1rem',
                  outline: 'none',
                  boxShadow: '0 1px 0 rgba(15, 23, 42, 0.02)'
                }}
                disabled={isTyping}
              />
              <button
                type="button"
                onClick={toggleListen}
                disabled={isTyping}
                style={{
                  position: 'absolute',
                  right: '112px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: isListening ? '#ef4444' : '#55657a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={isListening ? 'Stop voice input' : 'Start voice input'}
                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              style={{
                border: 'none',
                borderRadius: '12px',
                background: '#7fd8c5',
                color: '#0d2d2a',
                padding: '14px 28px',
                fontWeight: 700,
                cursor: !inputValue.trim() || isTyping ? 'not-allowed' : 'pointer',
                opacity: !inputValue.trim() || isTyping ? 0.7 : 1,
                minWidth: '120px'
              }}
            >
              {isTyping ? <Loader2 size={18} className="spin" /> : t('ui.send')}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default Assistant;
