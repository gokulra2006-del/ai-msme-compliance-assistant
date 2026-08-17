import { useState, useContext, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';
import { Mic, MicOff, Volume2, Square, AlertCircle, Loader2, ChevronRight, ChevronDown, Shield, ShieldCheck, Search, SlidersHorizontal, LayoutGrid, List, Info, ArrowLeft, SendHorizontal, Bot, X, FileText, Upload, Copy, ThumbsUp, ThumbsDown, CheckCheck, Briefcase, Sparkles } from 'lucide-react';
import {
  DOCUMENT_TOPICS,
  UNLINKED_GROUP_CODE,
  buildWhyRequired,
  groupByObligation,
  isInsufficient,
  searchRows
} from '../data/documentTopics';
import type { EvidenceRow, ObligationGroup } from '../data/documentTopics';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  businessMeaning?: string;
  aiExplanation?: string;
  recommendedAction?: string;
  sources?: any[];
  error?: boolean;
  actionType?: string;
  actionTarget?: string;
}

/** Maps an evidence record's review state onto the requirement-status vocabulary. */
const statusFromVerification = (verificationStatus?: string | null): string => {
  switch (verificationStatus) {
    case 'VERIFIED': return 'AVAILABLE';
    case 'REJECTED': return 'REJECTED';
    case 'UNDER_REVIEW': return 'UNDER_REVIEW';
    case 'EXPIRED': return 'EXPIRED';
    default: return 'UNVERIFIED';
  }
};

/**
 * Status pill for a requirement row, reusing the existing badge classes. Every
 * state shown here is one the backend reported — nothing is assumed to be fine.
 */
const renderDocStatusBadge = (row: EvidenceRow) => {
  switch (row.status) {
    case 'MISSING': return <span className="badge badge-red">Missing</span>;
    case 'EXPIRED': return <span className="badge badge-red">Expired</span>;
    case 'REJECTED': return <span className="badge badge-red">Rejected</span>;
    case 'UNDER_REVIEW': return <span className="badge badge-blue">Under review</span>;
    case 'UNVERIFIED': return <span className="badge badge-amber">Unverified</span>;
    case 'AVAILABLE':
      return row.expiryStatus === 'EXPIRING_SOON'
        ? <span className="badge badge-amber">Expiring soon</span>
        : <span className="badge badge-green">Verified</span>;
    default: return <span className="badge badge-muted">{row.status || '—'}</span>;
  }
};

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: 'badge-red',
  HIGH: 'badge-red',
  MEDIUM: 'badge-amber',
  LOW: 'badge-muted'
};

/**
 * Tile colour and glyph per category. Keyed by topic id, so a topic added to
 * DOCUMENT_TOPICS falls back to its own icon on a neutral tile rather than
 * breaking the grid.
 */
const TOPIC_THEME: Record<string, { bg: string; icon: string }> = {
  ALL: { bg: '#ede9fe', icon: '📄' },
  LICENCE: { bg: '#fef3c7', icon: '📜' },
  FILING: { bg: '#dbeafe', icon: '🧾' },
  REGISTER: { bg: '#fce7f3', icon: '📋' },
  CERTIFICATE: { bg: '#d1fae5', icon: '✅' },
  MISSING: { bg: '#fee2e2', icon: '⚠️' },
  RENEWAL: { bg: '#fff7ed', icon: '🔄' },
  HIGH_RISK: { bg: '#fef2f2', icon: '🔍' },
  DEADLINE: { bg: '#eff6ff', icon: '📅' },
  OTHER: { bg: '#f1f5f9', icon: '⋯' }
};

const formatDate = (value?: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
};

/** One labelled fact. Renders nothing when the backend had no value for it. */
const DetailRow = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <div className="doc-detail__row">
      <span className="doc-detail__label">{label}</span>
      <span className="doc-detail__value">{value}</span>
    </div>
  ) : null;

/**
 * Obligation → required evidence, as one list. Shared by the category view and
 * the search results so both read the same way and stay in step.
 */
const DocGroupList = ({
  groups,
  onSelect
}: {
  groups: ObligationGroup[];
  onSelect: (row: EvidenceRow) => void;
}) => (
  <div className="doc-group-list">
    {groups.map((group) => (
      <div key={group.obligationCode} className="doc-group">
        <div className="doc-group__head">
          <span style={{ minWidth: 0 }}>
            <span className="doc-group__title">{group.obligationTitle}</span>
            <span className="doc-group__meta">
              {[
                group.obligationCode === UNLINKED_GROUP_CODE
                  ? 'Not linked to a compliance obligation'
                  : group.obligationCode,
                group.domain,
                group.traceability && !isInsufficient(group.traceability.actName)
                  ? group.traceability.actName
                  : null,
                group.complianceFrequency && !isInsufficient(group.complianceFrequency)
                  ? group.complianceFrequency
                  : null
              ].filter(Boolean).join(' · ')}
            </span>
          </span>
          {group.severity && (
            <span className={`badge ${SEVERITY_BADGE[group.severity] || 'badge-muted'}`}>
              {group.severity}
            </span>
          )}
        </div>

        <span className="doc-group__label">Required evidence</span>
        <div className="doc-cat-list">
          {group.rows.map((row) => (
            <button
              key={row.key}
              type="button"
              className="doc-cat-item"
              onClick={() => onSelect(row)}
            >
              <span style={{ minWidth: 0 }}>
                <span className="doc-cat-item__name">{row.documentType}</span>
                <span className="doc-cat-item__meta">
                  {row.evidence?.documentName || 'No document on file yet'}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                {renderDocStatusBadge(row)}
                <ChevronRight size={16} className="doc-cat-card__arrow" />
              </span>
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
);



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

/**
 * Merges the two existing evidence endpoints into one row list.
 *
 * `requiredDocuments` is the GAWK-derived requirement matrix — one row per
 * required document, including the ones still MISSING, each already carrying
 * the traceability chain back to its rule. Rows pass through untouched.
 *
 * Uploads that satisfy no requirement are appended so the business's own files
 * are never hidden. They carry no obligation and no traceability, and none is
 * inferred for them.
 */
const buildRows = (required: any[], uploaded: any[]): EvidenceRow[] => {
  const linkedEvidenceIds = new Set<string>();

  const requirementRows: EvidenceRow[] = required.map((row: any) => {
    if (row.evidenceId) linkedEvidenceIds.add(String(row.evidenceId));
    return { ...row, key: row.key || `${row.obligationCode}::${row.documentType}` } as EvidenceRow;
  });

  const unlinkedUploads: EvidenceRow[] = uploaded
    .filter((ev: any) => !linkedEvidenceIds.has(String(ev._id)))
    .map((ev: any) => ({
      key: `evidence::${ev._id}`,
      obligationCode: '',
      obligationTitle: '',
      documentType: ev.documentType || ev.documentName || '',
      severity: null,
      domain: null,
      dueDate: null,
      status: statusFromVerification(ev.verificationStatus),
      expiryStatus: ev.expiryStatus ?? null,
      verificationStatus: ev.verificationStatus ?? null,
      expiryDate: ev.expiryDate ?? null,
      evidenceId: String(ev._id),
      evidence: {
        evidenceId: String(ev._id),
        documentName: ev.documentName,
        documentType: ev.documentType,
        documentNumber: ev.documentNumber ?? null,
        issuingAuthority: ev.issuingAuthority ?? null,
        issueDate: ev.issueDate ?? null,
        expiryDate: ev.expiryDate ?? null,
        expiryStatus: ev.expiryStatus ?? null,
        verificationStatus: ev.verificationStatus ?? null,
        version: ev.version ?? null,
        uploadedAt: ev.createdAt ?? null
      },
      traceability: null
    }));

  return [...requirementRows, ...unlinkedUploads];
};

const Assistant = () => {
  const { token, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Business profile — used for industry-aware Quick Access
  const [businessIndustry, setBusinessIndustry] = useState<string | null>(null);

  // Documents browser: questions → obligations + evidence → document detail
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<EvidenceRow | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [docQuery, setDocQuery] = useState('');
  const [docs, setDocs] = useState<EvidenceRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [docsError, setDocsError] = useState('');
  // Determines which layout is active in Quick Access view
  const [docViewMode, setDocViewMode] = useState<'grid' | 'list'>('grid');
  // Filters the cards shown in Quick Access view
  const [gridCategory, setGridCategory] = useState<string>('ALL');
  const [listFilter, setListFilter] = useState<'all' | 'MISSING' | 'AVAILABLE' | 'IN_REVIEW' | 'APPROVED'>('all');
  /**
   * The dashboard reports `hasProfile: false` with an empty document list and
   * HTTP 200 when no business profile is saved. Without reading the flag, that
   * success-with-no-data was indistinguishable from "nothing is required of
   * you", and the hub rendered an unexplained pair of empty cards.
   */
  const [docsHasProfile, setDocsHasProfile] = useState<boolean | null>(null);
  /** Rules the engine could not decide because the profile lacks fields they test. */
  const [docsUndecided, setDocsUndecided] = useState(0);

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

  // Fetch business profile to power industry-aware Quick Access
  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:5000/api/business', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      const ind = res.data?.data?.industry;
      if (ind) setBusinessIndustry(ind);
    }).catch(() => {/* Profile not set yet — use defaults */ });
  }, [token]);

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

  // Loads the business's real compliance documents once per session, from the
  // same two endpoints the Evidence Vault already uses.
  const loadDocuments = async () => {
    if (docsLoading) return;
    setDocsLoading(true);
    setDocsError('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, evidenceRes] = await Promise.all([
        axios.get('http://localhost:5000/api/evidence/dashboard', { headers }),
        axios.get('http://localhost:5000/api/evidence?latest=true', { headers })
      ]);
      const dash = dashRes.data?.data || {};
      setDocsHasProfile(dash.hasProfile !== false);
      setDocsUndecided(
        Array.isArray(dash.insufficientDataObligations) ? dash.insufficientDataObligations.length : 0
      );
      setDocs(buildRows(dash.requiredDocuments || [], evidenceRes.data?.data || []));
      setDocsLoaded(true);
    } catch (err: any) {
      setDocsError(err.response?.data?.error || 'Could not load your documents. Please try again.');
    } finally {
      setDocsLoading(false);
    }
  };

  // The hub has nothing to show until these rows arrive, so fetch on mount
  // rather than waiting for an interaction.
  useEffect(() => {
    if (token && !docsLoaded) loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * Runs every topic's predicate over the loaded rows. A topic with no matching
   * rows is dropped, so no question can appear that the ruleset does not
   * support. "Other" and the catch-all are kept regardless of count.
   */
  const rowsByTopic = useMemo(() => {
    const grouped: Record<string, EvidenceRow[]> = {};
    DOCUMENT_TOPICS.forEach(topic => {
      grouped[topic.id] = docs.filter(topic.matches);
    });
    return grouped;
  }, [docs]);

  const visibleTopics = useMemo(() => {
    let topics = DOCUMENT_TOPICS.filter(topic => topic.alwaysShow || (rowsByTopic[topic.id]?.length || 0) > 0);
    if (gridCategory !== 'ALL') {
      topics = topics.filter(topic => topic.id === gridCategory);
    }
    return topics;
  }, [rowsByTopic, gridCategory]);

  const activeTopic = DOCUMENT_TOPICS.find(topic => topic.id === activeTopicId) || null;
  const trimmedDocQuery = docQuery.trim();

  /**
   * The search narrows whatever is on screen: the whole catalogue from the
   * question grid, or one question's documents once it is open.
   */
  const activeTopicRows = useMemo(() => {
    const rows = activeTopicId ? rowsByTopic[activeTopicId] || [] : [];
    return trimmedDocQuery ? searchRows(rows, trimmedDocQuery) : rows;
  }, [activeTopicId, rowsByTopic, trimmedDocQuery]);

  const activeTopicStats = useMemo(() => {
    const stats = { total: 0, missing: 0, available: 0, inReview: 0, approved: 0 };
    activeTopicRows.forEach(row => {
      stats.total++;
      if (row.status === 'MISSING') stats.missing++;
      else if (row.status === 'AVAILABLE') stats.available++;
      else if (row.status === 'IN REVIEW') stats.inReview++;
      else if (row.status === 'APPROVED') stats.approved++;
    });
    return stats;
  }, [activeTopicRows]);

  const filteredTopicRows = useMemo(() => {
    if (listFilter === 'all') return activeTopicRows;
    return activeTopicRows.filter(row => {
      if (listFilter === 'IN_REVIEW') return row.status === 'IN REVIEW';
      return row.status === listFilter;
    });
  }, [activeTopicRows, listFilter]);

  const activeTopicGroups = useMemo(() => groupByObligation(filteredTopicRows), [filteredTopicRows]);

  const searchResultGroups = useMemo(
    () => (trimmedDocQuery ? groupByObligation(searchRows(docs, trimmedDocQuery)) : []),
    [docs, trimmedDocQuery]
  );

  const searchResultCount = useMemo(
    () => searchResultGroups.reduce((total, group) => total + group.rows.length, 0),
    [searchResultGroups]
  );

  const handleTopicSelect = (topicId: string) => {
    setActiveTopicId(topicId);
    setSelectedRow(null);
    setCustomQuestion('');
    setDocQuery('');
  };

  const handleRowSelect = (row: EvidenceRow) => {
    setSelectedRow(row);
    setCustomQuestion('');
  };

  const handleDocumentQuestionSubmit = () => {
    if (!customQuestion.trim() || !selectedRow) return;
    const name = selectedRow.evidence?.documentName || selectedRow.documentType;
    const reference = selectedRow.obligationCode ? ` (${selectedRow.obligationCode})` : '';
    const question = `About ${name}${reference}: ${customQuestion}`;
    handleSend(question);
  };

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

    // Check if this is a document classification or document-related question
    const isClassifyRequest = question.toLowerCase().includes('classify') || question.toLowerCase().includes('document category') || question.toLowerCase().includes('document type');

    // Extract document name if provided in format "Classify: FSSAI License" or "Document: PAN Certificate"
    const docNameMatch = question.match(/classify[:\s]+(.+?)(?:\?|$)/i) || question.match(/document[:\s]+(.+?)(?:\?|$)/i);
    const documentName = docNameMatch?.[1]?.trim();

    // If user asked to classify but didn't provide document name, ask for it
    if (isClassifyRequest && !documentName) {
      try {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          content: '📄 Sure! I can help you classify a document. What is the name or type of the document you want to classify? (e.g., "FSSAI License", "GST Certificate", "Factory Permit", "PAN Certificate")'
        };
        setMessages(prev => [...prev, aiMsg]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    // If document name was extracted, classify it
    if (isClassifyRequest && documentName && documentName.length > 2) {
      try {
        const res = await axios.post(
          'http://localhost:5000/api/assistant/classify-document',
          { documentName },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const classData = res.data.data;
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          content: `📄 **${classData.documentName}**\n\n**Category:** ${classData.classification}\n**Confidence:** ${classData.confidence}%\n\n${classData.recommendation}`
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          content: '❌ Could not classify the document. ' + (err.response?.data?.error || 'Please provide the document name more clearly.'),
          error: true
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

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
        aiExplanation: aiData.aiExplanation,
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

  /* ── View resolution ─────────────────────────────────────────────
     Exactly one of these five is on screen at a time. Resolving them
     into named booleans up front keeps the JSX below readable and
     stops the header, footer and body from disagreeing about which
     view is active.                                                */
  const isChatting = messages.length > 0;
  const isSearching = !isChatting && !selectedRow && !activeTopic && trimmedDocQuery.length > 0;
  /** Search and the verified banner belong to the browsing views only. */
  const isBrowsing = !isChatting;

  const whyRequired = selectedRow ? buildWhyRequired(selectedRow) : null;

  const handleBack = () => {
    if (isChatting) setMessages([]);
    else if (selectedRow) setSelectedRow(null);
    else setActiveTopicId(null);
  };

  const backLabel = isChatting
    ? 'Documents'
    : selectedRow
      ? (activeTopic ? activeTopic.shortLabel : 'documents')
      : 'all categories';

  // ============================================================
  // DOCUMENTS FULL-PAGE HUB (Main Assistant View)
  //
  // Three regions, in this order: a fixed top, one scrolling body,
  // and a footer docked to the bottom edge. The composer lives in
  // the footer so it stays reachable no matter how long the body
  // gets — it is the page's primary action.
  // ============================================================
  return (
    <AppLayout pageTitle="Grounded Compliance Assistant" fullBleed>
      <div className="docs-hub">
        {/* ── Fixed top region ── */}
        <div className="docs-hub__top">
          <div className="docs-hub__shell">
            <div className="docs-hub__header">
              <div className="docs-hub__header-text">
                {(isChatting || selectedRow || activeTopicId) && (
                  <button type="button" className="docs-hub__back" onClick={handleBack}>
                    <ArrowLeft size={14} /> Back to {backLabel}
                  </button>
                )}
                <h1 className="docs-hub__title">Documents</h1>
                <p className="docs-hub__subtitle">
                  {isChatting
                    ? 'Answers are grounded in the verified obligations and documents on your SurakshaSetu profile.'
                    : 'Explore compliance documents and evidence by category, or ask a specific question.'}
                </p>
              </div>
              <div className="docs-hub__illustration" aria-hidden="true">
                <div className="docs-hub__illus-icon">📋</div>
                <div className="docs-hub__illus-badge">✅</div>
                <div className="docs-hub__illus-star docs-hub__illus-star--1">✦</div>
                <div className="docs-hub__illus-star docs-hub__illus-star--2">✦</div>
              </div>
            </div>

            {isBrowsing && (
              <>
                {/* ── Search ── */}
                <div className="docs-hub__search-row">
                  <div className="docs-hub__search-wrap">
                    <Search size={18} className="docs-hub__search-icon" />
                    <input
                      type="text"
                      className="docs-hub__search-input"
                      placeholder="Search documents or ask a question (e.g., What is GST Registration Certificate?)"
                      value={docQuery}
                      onChange={e => setDocQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && docQuery.trim()) {
                          handleSend(docQuery.trim());
                          setDocQuery('');
                        }
                      }}
                    />
                    {docQuery && (
                      <button
                        type="button"
                        className="docs-hub__search-clear"
                        onClick={() => setDocQuery('')}
                        aria-label="Clear search"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <button type="button" className="docs-hub__filter-btn" title="Filters" aria-label="Filters">
                    <SlidersHorizontal size={18} />
                  </button>
                </div>


              </>
            )}
          </div>
        </div>

        {/* ── Scrolling body ── */}
        <div className="docs-hub__main">
          <div className="docs-hub__shell docs-hub__shell--body">
            {isChatting ? (
              /* ── Conversation ── */
              <div className="docs-chat">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`docs-msg docs-msg--${msg.sender}${msg.error ? ' docs-msg--error' : ''}`}
                  >
                    <div className="docs-msg__bubble">
                      {msg.sender === 'assistant' && (
                        <div className="docs-msg__header">
                          <div className="docs-msg__avatar-wrap">
                            <Shield size={16} className="docs-msg__avatar-icon" />
                          </div>
                          <div className="docs-msg__sender-info">
                            <span className="docs-msg__sender-name">SurakshaSetu AI</span>
                            <span className="docs-msg__badge"><ShieldCheck size={12} /> Verified</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="docs-msg__text">{msg.content}</div>

                      {msg.businessMeaning && (
                        <div className="docs-msg__block">
                          <h4 className="docs-msg__block-title"><Briefcase size={14} /> Business meaning</h4>
                          <p className="docs-msg__block-text">{msg.businessMeaning}</p>
                        </div>
                      )}

                      {msg.recommendedAction && (
                        <div className="docs-msg__action">
                          <h4 className="docs-msg__action-title">Recommended action</h4>
                          <p className="docs-msg__action-text">{msg.recommendedAction}</p>
                        </div>
                      )}

                      {msg.actionType === 'PREPARE_DOCUMENT' && msg.actionTarget && (
                        <button
                          type="button"
                          className="docs-msg__cta"
                          onClick={() => navigate(`/prepare-document?type=${encodeURIComponent(msg.actionTarget!)}`)}
                        >
                          Prepare document <ChevronRight size={15} />
                        </button>
                      )}

                      {msg.sender === 'assistant' && !msg.error && (
                        <>
                          {msg.aiExplanation && (
                            <div className="docs-msg__block">
                              <h4 className="docs-msg__block-title"><Sparkles size={14} /> AI explanation (OpenRouter)</h4>
                              <p className="docs-msg__block-text">{msg.aiExplanation}</p>
                            </div>
                          )}
                          
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="docs-msg__block">
                              <h4 className="docs-msg__block-title"><FileText size={14} /> Sources (SurakshaSetu)</h4>
                              <ul className="docs-msg__sources-list">
                                {msg.sources.map((s, idx) => (
                                  <li key={idx} className="docs-msg__source-item">
                                    {s.actName || s.ruleCode} {s.section ? `(${s.section})` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="docs-msg__foot">
                            <span className="docs-msg__timestamp">
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="docs-msg__actions">
                              <button type="button" className="docs-msg__action-btn" title="Copy"><Copy size={14} /></button>
                              <button type="button" className="docs-msg__action-btn" title="Helpful"><ThumbsUp size={14} /></button>
                              <button type="button" className="docs-msg__action-btn" title="Not helpful"><ThumbsDown size={14} /></button>
                              <button
                                type="button"
                                className={`docs-msg__action-btn docs-msg__speak${isSpeakingId === msg.id ? ' is-active' : ''}`}
                                onClick={() => toggleSpeak(msg)}
                                title={isSpeakingId === msg.id ? 'Stop speaking' : 'Read aloud'}
                              >
                                {isSpeakingId === msg.id
                                  ? <Square size={14} fill="currentColor" />
                                  : <Volume2 size={14} />}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {msg.sender === 'user' && (
                        <div className="docs-msg__foot docs-msg__foot--user">
                          <span className="docs-msg__timestamp">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <CheckCheck size={14} className="docs-msg__read-receipt" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="docs-msg docs-msg--assistant">
                    <div className="docs-msg__bubble docs-msg__bubble--typing">
                      <span className="dot-pulse" />
                      <span className="dot-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="dot-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            ) : activeTopic || isSearching ? (
              <div className={`docs-split ${selectedRow ? 'has-detail' : ''}`}>
                <div className="docs-split__master">
                  {activeTopic ? (
                    <>
                      <div className="docs-hub__section-header docs-hub__section-header--topic">
                        <div className="docs-hub__topic-header-main">
                          <button type="button" className="docs-split__back" onClick={handleBack}>
                            <ArrowLeft size={16} />
                            <span>Back to all<br/>categories</span>
                          </button>
                          <div className="docs-hub__topic-title-group">
                            <h2 className="docs-split__title">{activeTopic.question}</h2>
                            <p className="docs-split__sub">Documents required by the applicable compliance rules for your business.</p>
                          </div>
                        </div>
                        
                        <div className="docs-split__actions">
                          <div className="docs-split__search">
                            <Search size={16} className="docs-split__search-icon" />
                            <input 
                              type="text" 
                              placeholder="Search documents in this category..." 
                              value={docQuery}
                              onChange={(e) => setDocQuery(e.target.value)}
                            />
                          </div>
                          <button className="docs-split__filter-btn" title="Advanced Filters">
                            <SlidersHorizontal size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="docs-summary-dash">
                        <div className="docs-summary-card">
                          <span className="docs-summary-val">{activeTopicStats.total}</span>
                          <span className="docs-summary-lbl">Total Documents</span>
                        </div>
                        <div className="docs-summary-card docs-summary-card--missing">
                          <span className="docs-summary-val">{activeTopicStats.missing}</span>
                          <span className="docs-summary-lbl">Missing</span>
                        </div>
                        <div className="docs-summary-card docs-summary-card--available">
                          <span className="docs-summary-val">{activeTopicStats.available}</span>
                          <span className="docs-summary-lbl">Available</span>
                        </div>
                        <div className="docs-summary-card docs-summary-card--review">
                          <span className="docs-summary-val">{activeTopicStats.inReview}</span>
                          <span className="docs-summary-lbl">In Review</span>
                        </div>
                        <div className="docs-summary-card docs-summary-card--approved">
                          <span className="docs-summary-val">{activeTopicStats.approved}</span>
                          <span className="docs-summary-lbl">Approved</span>
                        </div>
                      </div>

                      <div className="docs-filter-row">
                        <div className="docs-filter-tabs">
                          <button className={`docs-filter-tab ${listFilter === 'all' ? 'active' : ''}`} onClick={() => setListFilter('all')}>All Status</button>
                          <button className={`docs-filter-tab ${listFilter === 'MISSING' ? 'active' : ''}`} onClick={() => setListFilter('MISSING')}>Missing</button>
                          <button className={`docs-filter-tab ${listFilter === 'AVAILABLE' ? 'active' : ''}`} onClick={() => setListFilter('AVAILABLE')}>Available</button>
                          <button className={`docs-filter-tab ${listFilter === 'IN_REVIEW' ? 'active' : ''}`} onClick={() => setListFilter('IN_REVIEW')}>In Review</button>
                          <button className={`docs-filter-tab ${listFilter === 'APPROVED' ? 'active' : ''}`} onClick={() => setListFilter('APPROVED')}>Approved</button>
                        </div>
                        <div className="docs-sort-dropdown">
                           Sort by: Priority <ChevronDown size={14} />
                        </div>
                      </div>

                      <div className="docs-master-list">
                        {filteredTopicRows.length === 0 ? (
                          <div className="doc-cat-empty">
                            <strong>No documents match your filter.</strong>
                          </div>
                        ) : (
                          filteredTopicRows.map((row, idx) => (
                            <button
                              key={row.key}
                              type="button"
                              className={`docs-master-row ${selectedRow?.key === row.key ? 'is-selected' : ''}`}
                              onClick={() => setSelectedRow(row)}
                            >
                              <span className="docs-master-row__num">{(idx + 1).toString().padStart(2, '0')}</span>
                              <div className="docs-master-row__icon">
                                {row.documentType === 'LICENCE' ? '📜' :
                                 row.documentType === 'REGISTER' ? '📋' :
                                 row.documentType === 'FILING' ? '🧾' : '📄'}
                              </div>
                              <div className="docs-master-row__content">
                                <span className="docs-master-row__title">{row.evidence?.documentName || row.documentType}</span>
                                <span className="docs-master-row__meta">
                                  {row.obligationCode || 'Unlinked'} · {row.domain || 'General'} · {row.complianceFrequency || 'As required'}
                                </span>
                              </div>
                              <div className="docs-master-row__badges">
                                {row.severity && (
                                  <span className={`badge ${SEVERITY_BADGE[row.severity] || 'badge-muted'}`}>{row.severity}</span>
                                )}
                                {renderDocStatusBadge(row)}
                              </div>
                              <ChevronRight size={16} className="docs-master-row__arrow" />
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="docs-hub__section-header">
                        <div>
                          <h2 className="docs-hub__section-title">
                            {searchResultCount} result{searchResultCount === 1 ? '' : 's'} for “{trimmedDocQuery}”
                          </h2>
                          <p className="docs-hub__section-sub">
                            Matched on document name, obligation and issuing authority.
                          </p>
                        </div>
                        <button type="button" className="docs-hub__text-btn" onClick={() => setDocQuery('')}>
                          Clear search
                        </button>
                      </div>
                      <DocGroupList groups={searchResultGroups} onSelect={setSelectedRow} />
                    </>
                  )}
                </div>

                {selectedRow && (
                  <div className="docs-split__detail">
                    <div className="doc-panel fade-in">
                      <div className="doc-panel__top">
                        <button className="doc-panel__close" onClick={() => setSelectedRow(null)}><X size={18} /></button>
                      </div>
                      <div className="doc-panel__head">
                        <div className="doc-panel__icon">
                          {selectedRow.documentType === 'LICENCE' ? '📜' :
                           selectedRow.documentType === 'REGISTER' ? '📋' :
                           selectedRow.documentType === 'FILING' ? '🧾' : '📄'}
                        </div>
                        <div className="doc-panel__heading">
                          <h2 className="doc-panel__title">{selectedRow.evidence?.documentName || selectedRow.documentType}</h2>
                          <p className="doc-panel__ref">{selectedRow.obligationCode || 'Unlinked'} · {selectedRow.domain || 'General'} · {selectedRow.complianceFrequency || 'As required'}</p>
                        </div>
                        {selectedRow.severity && <span className={`badge ${SEVERITY_BADGE[selectedRow.severity] || 'badge-muted'}`}>{selectedRow.severity}</span>}
                      </div>

                      <div className="doc-panel__alert">
                        <div className="doc-panel__alert-icon"><ShieldCheck size={16} /></div>
                        <p>This document is mandatory as per applicable compliance rules for your business.</p>
                      </div>

                      <div className="doc-panel__section">
                        <h3 className="doc-panel__section-title">About this document</h3>
                        <p className="doc-panel__section-text">{whyRequired || 'No description available for this requirement.'}</p>
                      </div>

                      {selectedRow.obligationCode && (
                        <div className="doc-panel__section">
                          <h3 className="doc-panel__section-title">Related Obligation</h3>
                          <div className="doc-panel__box">
                            <div className="doc-panel__box-content">
                              <strong>{selectedRow.obligationTitle}</strong>
                              <span>Obligation ID: {selectedRow.obligationCode}</span>
                            </div>
                            <ChevronRight size={16} className="doc-panel__box-arrow" />
                          </div>
                        </div>
                      )}

                      <div className="doc-panel__section">
                        <h3 className="doc-panel__section-title">Required Evidence</h3>
                        <div className="doc-panel__box">
                          <div className="doc-panel__box-content">
                            <FileText size={16} className="doc-panel__box-icon" />
                            <div>
                              <strong>{selectedRow.evidence?.documentName || selectedRow.documentType}</strong>
                              <span>{selectedRow.documentType} requirement</span>
                            </div>
                          </div>
                          {renderDocStatusBadge(selectedRow)}
                          <ChevronRight size={16} className="doc-panel__box-arrow" />
                        </div>
                      </div>

                      <div className="doc-panel__grid">
                        <div>
                          <div className="doc-panel__label">Frequency</div>
                          <div className="doc-panel__value">{selectedRow.complianceFrequency || 'Monthly'}</div>
                        </div>
                        <div>
                          <div className="doc-panel__label">Due Date</div>
                          <div className="doc-panel__value">{formatDate(selectedRow.dueDate) || '10th of next month'}</div>
                        </div>
                      </div>

                      <div className="doc-panel__section">
                        <div className="doc-panel__label">Source</div>
                        <div className="doc-panel__source">
                          Verified regulations in SurakshaSetu (GAWK) <ShieldCheck size={14} className="doc-panel__source-icon" />
                        </div>
                      </div>

                      <button className="doc-panel__upload-btn" onClick={() => navigate(`/prepare-document?type=${encodeURIComponent(selectedRow.evidence?.documentName || selectedRow.documentType)}`)}>
                        <Upload size={16} /> View / Upload Evidence
                      </button>

                      <div className="doc-cat-ask">
                        <Info size={16} className="doc-cat-ask__icon" />
                        <div className="doc-cat-ask__content">
                          <span className="doc-cat-ask__label">Ask about this document</span>
                          <div className="doc-cat-ask__input-wrap">
                            <input
                              type="text"
                              className="doc-cat-ask__input"
                              placeholder="e.g., What is the penalty for not having this?"
                              value={customQuestion}
                              onChange={e => setCustomQuestion(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleDocumentQuestionSubmit();
                              }}
                            />
                            <button
                              type="button"
                              className="doc-cat-ask__btn"
                              onClick={handleDocumentQuestionSubmit}
                              disabled={!customQuestion.trim() || isTyping}
                            >
                              Ask
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedRow ? (
              <div className="doc-detail fade-in">
                <div className="doc-detail__head">
                  <div className="doc-detail__icon" aria-hidden="true">
                    {selectedRow.documentType === 'LICENCE' ? '📜' :
                      selectedRow.documentType === 'REGISTER' ? '📋' :
                        selectedRow.documentType === 'FILING' ? '🧾' : '📄'}
                  </div>
                  <div className="doc-detail__heading">
                    <h2 className="doc-detail__title">{selectedRow.evidence?.documentName || selectedRow.documentType}</h2>
                  </div>
                  {renderDocStatusBadge(selectedRow)}
                </div>
                <div className="doc-detail__card">
                  <div className="doc-detail__card-title">Document information</div>
                  <div className="doc-detail__grid">
                    <DetailRow label="Requirement status" value={selectedRow.status} />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Category grid ── */
              <>
                {docsError && (
                  <div className="doc-cat-empty doc-cat-empty--error">
                    <strong>{docsError}</strong>
                    <button type="button" className="doc-cat-back" onClick={loadDocuments}>
                      Try again
                    </button>
                  </div>
                )}

                {!docsError && docsHasProfile === false ? (
                  <div className="doc-cat-empty doc-cat-empty--action">
                    <strong>Your business profile isn't set up yet.</strong>
                    <p>
                      The deterministic engine works out which documents you need from your profile.
                      Until that is saved, there are no obligations to list here.
                    </p>
                    <button type="button" className="doc-cat-back" onClick={() => navigate('/onboarding')}>
                      Set up business profile →
                    </button>
                  </div>
                ) : !docsError && docsLoaded && docs.length === 0 ? (
                  <div className="doc-cat-empty doc-cat-empty--action">
                    <strong>No document requirements yet.</strong>
                    <p>
                      The engine evaluated the active ruleset against your profile and no obligation
                      currently requires a document.
                    </p>
                    <button type="button" className="doc-cat-back" onClick={() => navigate('/onboarding')}>
                      Complete your profile →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="docs-hub__section-header">
                      <div>
                        <h2 className="docs-hub__section-title">Quick Access</h2>
                        <p className="docs-hub__section-sub">
                          {businessIndustry ? (
                            <>Showing documents tailored for <strong>{businessIndustry}</strong>. Choose a category to find the right documents.</>
                          ) : (
                            'Choose a category to find the right documents and get detailed answers.'
                          )}
                        </p>
                      </div>
                      <div className="docs-hub__view-controls">
                        <div className="docs-hub__view-toggle">
                          <button
                            type="button"
                            className={`docs-hub__view-btn ${docViewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setDocViewMode('grid')}
                            title="Grid view"
                            aria-label="Grid view"
                            aria-pressed={docViewMode === 'grid'}
                          >
                            <LayoutGrid size={16} />
                          </button>
                          <button
                            type="button"
                            className={`docs-hub__view-btn ${docViewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setDocViewMode('list')}
                            title="List view"
                            aria-label="List view"
                            aria-pressed={docViewMode === 'list'}
                          >
                            <List size={16} />
                          </button>
                        </div>
                        <select 
                          className="docs-hub__cat-select" 
                          value={gridCategory}
                          onChange={(e) => setGridCategory(e.target.value)}
                          aria-label="Filter by category"
                        >
                          <option value="ALL">All Categories</option>
                          <option value="LICENCE">Licences</option>
                          <option value="FILING">Filings</option>
                          <option value="CERTIFICATE">Certificates</option>
                          <option value="REGISTER">Registers</option>
                        </select>
                      </div>
                    </div>

                    <div className={`docs-hub__quick-grid ${docViewMode === 'list' ? 'docs-hub__quick-grid--list' : ''}`}>
                      {visibleTopics.map(topic => {
                        const count = rowsByTopic[topic.id]?.length || 0;
                        const theme = TOPIC_THEME[topic.id] || { bg: '#f1f5f9', icon: topic.icon };
                        const isLoading = docsLoading && !docsLoaded;
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            className="docs-hub__quick-card"
                            onClick={() => handleTopicSelect(topic.id)}
                            disabled={isLoading}
                          >
                            <div className="docs-hub__quick-card-top">
                              <span className="docs-hub__quick-icon-wrap" style={{ background: theme.bg }}>
                                <span className="docs-hub__quick-icon">{theme.icon}</span>
                              </span>
                              <span className="docs-hub__quick-card-copy">
                                <span className="docs-hub__quick-card-title">{topic.question}</span>
                                <span className="docs-hub__quick-card-desc">{topic.blurb}</span>
                              </span>
                            </div>
                            <div className="docs-hub__quick-card-foot">
                              <span className={`docs-hub__quick-card-count${count > 0 ? ' has-docs' : ''}`}>
                                {isLoading
                                  ? 'Loading…'
                                  : count > 0
                                    ? `${count} document${count === 1 ? '' : 's'}`
                                    : 'No documents'}
                              </span>
                              <ChevronRight size={15} className="docs-hub__quick-card-arrow" />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {docsUndecided > 0 && (
                      <p className="doc-cat-note">
                        {docsUndecided} further rule{docsUndecided === 1 ? '' : 's'} could not be decided from
                        your profile.{' '}
                        <button type="button" className="doc-cat-note__link" onClick={() => navigate('/onboarding')}>
                          Complete your profile
                        </button>{' '}
                        to let the engine decide.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Docked footer: hint line + composer ── */}
        <div className="docs-hub__footer">


          <div className="docs-hub__chat-bar">
            <div className="docs-hub__shell">
              <form
                className="docs-composer"
                onSubmit={e => {
                  e.preventDefault();
                  handleSend(inputValue);
                }}
              >
                <div className={`docs-composer__field${isListening ? ' is-listening' : ''}`}>
                  <input
                    type="text"
                    className="docs-composer__input"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={isListening ? 'Listening…' : 'Ask a question about any document…'}
                    disabled={isTyping}
                    aria-label="Ask a question about any document"
                  />
                  <button
                    type="button"
                    className={`docs-composer__mic${isListening ? ' is-listening' : ''}`}
                    onClick={toggleListen}
                    disabled={isTyping}
                    title={isListening ? 'Stop voice input' : 'Start voice input'}
                    aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="docs-hub__chat-send"
                  disabled={!inputValue.trim() || isTyping}
                >
                  {isTyping
                    ? <><Loader2 size={16} className="spin" /> Sending</>
                    : <><SendHorizontal size={16} /> Send</>}
                </button>
              </form>

              {voiceError && (
                <p className="docs-composer__error">
                  <AlertCircle size={14} /> {voiceError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Assistant;
