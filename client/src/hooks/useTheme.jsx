import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const THEMES = ['system', 'light', 'dark'];

function getPreferredTheme() {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem('theme');
  return THEMES.includes(stored) ? stored : 'system';
}

function resolveDarkMode(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getPreferredTheme);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme(nextTheme) {
      const isDark = resolveDarkMode(nextTheme);
      root.classList.toggle('dark', isDark);
      root.dataset.theme = nextTheme;
    }

    applyTheme(theme);
    window.localStorage.setItem('theme', theme);

    function handleSystemChange() {
      if (theme === 'system') applyTheme('system');
    }

    media.addEventListener('change', handleSystemChange);
    return () => media.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
