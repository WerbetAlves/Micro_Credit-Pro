import React, { createContext, useContext, useState, ReactNode } from 'react';
import { locales, LocaleType, DictionaryType } from '../lib/translations';

interface LanguageContextType {
  language: LocaleType;
  setLanguage: (lang: LocaleType) => void;
  t: DictionaryType;
  formatCurrency: (value: number) => string;
  formatDate: (dateStr: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LocaleType>('pt');

  const t = locales[language];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    // Current format is "Oct 24, 2023"
    // For PT, let's just use the locale string if possible or manual conversion
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatCurrency, formatDate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
