import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../context/LanguageContext';
import { HelpCircle, ChevronDown } from 'lucide-react';

const LANGUAGES: { code: Language, nativeName: string }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'ta', nativeName: 'தமிழ்' },
  { code: 'hi', nativeName: 'हिन्दी' },
  { code: 'mr', nativeName: 'मराठी' },
  { code: 'gu', nativeName: 'ગુજરાતી' },
  { code: 'bn', nativeName: 'বাংলা' },
  { code: 'te', nativeName: 'తెలుగు' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', nativeName: 'മലയാളം' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ur', nativeName: 'اردو' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'as', nativeName: 'অসমীয়া' },
  { code: 'mai', nativeName: 'मैथिली' },
  { code: 'sat', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'ks', nativeName: 'کأشُر' },
  { code: 'ne', nativeName: 'नेपाली' },
  { code: 'sd', nativeName: 'سنڌي' },
  { code: 'kok', nativeName: 'कोंकणी' },
  { code: 'doi', nativeName: 'डोगरी' },
  { code: 'brx', nativeName: 'बड़ो' },
  { code: 'mni', nativeName: 'ꯃꯤꯇꯩꯂꯣꯟ' },
  { code: 'sa', nativeName: 'संस्कृतम्' }
];

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  const handleSelect = (code: Language) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      
      {/* Help Modal */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-elevated, #1e293b)',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            border: '1px solid var(--border)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>How to change language</h3>
            <ol style={{ paddingLeft: '20px', margin: '0 0 20px 0', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <li style={{ marginBottom: '8px' }}>Click the language selector in the top bar.</li>
              <li style={{ marginBottom: '8px' }}>Choose your preferred language from the list.</li>
              <li style={{ marginBottom: '8px' }}>The interface text will instantly change to the selected language.</li>
            </ol>
            <div style={{ 
              padding: '12px', 
              background: 'rgba(59, 130, 246, 0.1)', 
              borderLeft: '4px solid #3b82f6', 
              borderRadius: '0 4px 4px 0',
              marginBottom: '24px',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)'
            }}>
              <strong>Note:</strong> Changing the language only translates the interface. It does not delete, translate, or modify your saved business data.
            </div>
            <button 
              className="btn btn-accent" 
              style={{ width: '100%', padding: '10px' }}
              onClick={() => setShowHelp(false)}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Selector Component */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button 
          onClick={() => setShowHelp(true)}
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%'
          }}
          title="Language Help"
        >
          <HelpCircle size={16} />
        </button>

        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500,
              minWidth: '100px',
              justifyContent: 'space-between'
            }}
          >
            {currentLanguage.nativeName}
            <ChevronDown size={14} style={{ opacity: 0.7 }} />
          </button>

          {isOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              background: 'var(--bg-elevated, #1e293b)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 0',
              minWidth: '160px',
              maxHeight: '300px',
              overflowY: 'auto',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              zIndex: 1000
            }}>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px',
                    background: language === lang.code ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    fontWeight: language === lang.code ? 600 : 400,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = language === lang.code ? 'rgba(255,255,255,0.05)' : 'transparent'}
                >
                  {lang.nativeName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
