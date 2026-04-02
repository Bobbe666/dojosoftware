import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Verfügbare Themes
 */
export const THEMES = {
  'midnight': {
    id: 'midnight',
    name: 'Midnight Blue',
    description: 'Dunkles Theme mit Gold-Akzenten (Standard)',
    preview: 'linear-gradient(135deg, #0f0f23, #16213e)',
    isDark: true,
  },
  'tda-vib': {
    id: 'tda-vib',
    name: 'TDA-Vib Classic',
    description: 'Helles Theme mit traditionellem japanischem Design',
    preview: 'linear-gradient(135deg, #f5f0e6, #e8e0d0)',
    isDark: false,
  },
  'blue-ocean': {
    id: 'blue-ocean',
    name: 'Blue Ocean',
    description: 'Dunkles Theme mit blauen Akzenten',
    preview: 'linear-gradient(135deg, #0c1929, #1e3a5f)',
    isDark: true,
  },
  'green-forest': {
    id: 'green-forest',
    name: 'Green Forest',
    description: 'Dunkles Theme mit grünen Akzenten',
    preview: 'linear-gradient(135deg, #0d1f0d, #1a3d1a)',
    isDark: true,
  },
  'red-fire': {
    id: 'red-fire',
    name: 'Red Fire',
    description: 'Dunkles Theme mit roten Akzenten',
    preview: 'linear-gradient(135deg, #1a0a0a, #2d1515)',
    isDark: true,
  },
};

/**
 * Default Theme
 */
const DEFAULT_THEME = 'midnight';

/**
 * LocalStorage Key
 */
const STORAGE_KEY = 'dojo-theme';

/**
 * Theme Context
 */
const ThemeContext = createContext(undefined);

/**
 * Theme Provider Komponente
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    // Versuche Theme aus localStorage zu laden
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES[stored]) {
        return stored;
      }
    }
    return DEFAULT_THEME;
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  // Theme auf HTML-Element setzen
  useEffect(() => {
    const root = document.documentElement;

    // Setze data-theme Attribut
    root.setAttribute('data-theme', theme);

    // Speichere in localStorage
    localStorage.setItem(STORAGE_KEY, theme);

    // Meta theme-color für mobile Browser
    const themeData = THEMES[theme];
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor && themeData) {
      metaThemeColor.setAttribute('content', themeData.isDark ? '#0f0f23' : '#f5f0e6');
    }
  }, [theme]);

  // Theme wechseln mit Animation
  const setTheme = useCallback((newTheme) => {
    if (!THEMES[newTheme] || newTheme === theme) return;

    setIsTransitioning(true);

    // Kurze Animation beim Wechsel
    document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';

    setThemeState(newTheme);

    // Animation zurücksetzen
    setTimeout(() => {
      document.documentElement.style.transition = '';
      setIsTransitioning(false);
    }, 300);
  }, [theme]);

  // Aktuelles Theme-Objekt
  const currentTheme = THEMES[theme] || THEMES[DEFAULT_THEME];

  // Ist Dark Mode?
  const isDarkMode = currentTheme.isDark;

  // Theme Toggle (für einfachen Light/Dark Switch)
  const toggleDarkMode = useCallback(() => {
    if (isDarkMode) {
      setTheme('tda-vib'); // Zum hellen Theme
    } else {
      setTheme('midnight'); // Zum dunklen Theme
    }
  }, [isDarkMode, setTheme]);

  const value = {
    // Aktueller Theme-ID
    theme,
    // Theme setzen
    setTheme,
    // Alle verfügbaren Themes
    themes: THEMES,
    // Aktuelles Theme-Objekt mit Details
    currentTheme,
    // Ist Dark Mode?
    isDarkMode,
    // Toggle zwischen Light/Dark
    toggleDarkMode,
    // Wird gerade gewechselt?
    isTransitioning,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme Hook
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

/**
 * Theme Selector Komponente (für Einstellungen)
 */
export const ThemeSelector = ({ className = '' }) => {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className={`theme-selector ${className}`}>
      <div className="theme-selector__grid">
        {Object.values(themes).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-selector__option ${theme === t.id ? 'theme-selector__option--active' : ''}`}
            onClick={() => setTheme(t.id)}
            title={t.description}
          >
            <div
              className="theme-selector__preview"
              style={{ background: t.preview }}
            />
            <span className="theme-selector__name">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeContext;
