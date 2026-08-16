import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';

// Import all languages
import { as } from '../locales/as';
import { bn } from '../locales/bn';
import { brx } from '../locales/brx';
import { doi } from '../locales/doi';
import { gu } from '../locales/gu';
import { hi } from '../locales/hi';
import { kn } from '../locales/kn';
import { ks } from '../locales/ks';
import { kok } from '../locales/kok';
import { mai } from '../locales/mai';
import { ml } from '../locales/ml';
import { mni } from '../locales/mni';
import { mr } from '../locales/mr';
import { ne } from '../locales/ne';
import { or } from '../locales/or';
import { pa } from '../locales/pa';
import { sa } from '../locales/sa';
import { sat } from '../locales/sat';
import { sd } from '../locales/sd';
import { ta } from '../locales/ta';
import { te } from '../locales/te';
import { ur } from '../locales/ur';
import { en } from '../locales/en';

export type Language = 
  | 'as' | 'bn' | 'brx' | 'doi' | 'gu' | 'hi' | 'kn' | 'ks' | 'kok' | 'mai' 
  | 'ml' | 'mni' | 'mr' | 'ne' | 'or' | 'pa' | 'sa' | 'sat' | 'sd' | 'ta' 
  | 'te' | 'ur' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const dictionaries: Record<Language, Record<string, string>> = {
  as, bn, brx, doi, gu, hi, kn, ks, kok, mai, ml, mni, mr, ne, or, pa, sa, sat, sd, ta, te, ur, en
};

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { user, token } = useContext(AuthContext);
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    if (user && user.preferredLanguage) {
      setLanguageState(user.preferredLanguage as Language);
    } else {
      const storageKey = user?.id ? `surakshasetu_lang_${user.id}` : 'surakshasetu_lang_guest';
      const saved = localStorage.getItem(storageKey) as Language;
      if (saved && dictionaries[saved]) {
        setLanguageState(saved);
      } else {
        setLanguageState('en');
      }
    }
  }, [user]);

  useEffect(() => {
    // RTL support for Urdu, Kashmiri, Sindhi
    const rtlLangs = ['ur', 'ks', 'sd'];
    if (rtlLangs.includes(language)) {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [language]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    const storageKey = user?.id ? `surakshasetu_lang_${user.id}` : 'surakshasetu_lang_guest';
    localStorage.setItem(storageKey, lang);
    
    if (user && token) {
      try {
        await axios.put('http://localhost:5000/api/auth/preferences', 
          { preferredLanguage: lang }, 
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (err) {
        console.error('Failed to sync language preference', err);
      }
    }
  };

  const t = (key: string, fallback?: string): string => {
    const dict = dictionaries[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    // Fallback to English dictionary
    if (dictionaries['en'] && dictionaries['en'][key]) {
      return dictionaries['en'][key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
