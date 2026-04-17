import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeColor = {
  name: string;
  id: string;
  shades: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
};

export const THEMES: ThemeColor[] = [
  {
    name: 'Emerald',
    id: 'emerald',
    shades: {
      50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
      500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22'
    }
  },
  {
    name: 'Ocean',
    id: 'ocean',
    shades: {
      50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8',
      500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49'
    }
  },
  {
    name: 'Royal',
    id: 'royal',
    shades: {
      50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa',
      500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065'
    }
  },
  {
    name: 'Rose',
    id: 'rose',
    shades: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185',
      500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519'
    }
  },
  {
    name: 'Amber',
    id: 'amber',
    shades: {
      50: '#fffbe6', 100: '#fff1b8', 200: '#ffe58f', 300: '#ffd666', 400: '#ffc53d',
      500: '#faad14', 600: '#d48806', 700: '#ad6800', 800: '#874d00', 900: '#613400', 950: '#3d1e00'
    }
  }
];

interface ThemeContextType {
  currentTheme: ThemeColor;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentThemeState] = useState<ThemeColor>(THEMES[0]);

  useEffect(() => {
    const saved = localStorage.getItem('emerald-theme');
    if (saved) {
      const found = THEMES.find(t => t.id === saved);
      if (found) {
        setCurrentThemeState(found);
        applyTheme(found);
      }
    }
  }, []);

  const applyTheme = (theme: ThemeColor) => {
    const root = document.documentElement;
    Object.entries(theme.shades).forEach(([shades, color]) => {
      root.style.setProperty(`--primary-${shades}`, color);
    });
  };

  const setTheme = (id: string) => {
    const theme = THEMES.find(t => t.id === id);
    if (theme) {
      setCurrentThemeState(theme);
      applyTheme(theme);
      localStorage.setItem('emerald-theme', theme.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
