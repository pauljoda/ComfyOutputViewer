import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import packageJson from '../package.json';
import { STORAGE_KEYS } from './constants';
import type { ThemeMode } from './types';
import { useElementSize } from './hooks/useElementSize';

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });
  const [goHomeSignal, setGoHomeSignal] = useState(0);
  const { ref: navRef, height: navHeight } = useElementSize<HTMLElement>();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.theme, themeMode);
    const root = document.documentElement;
    const applyTheme = (mode: 'light' | 'dark') => {
      root.dataset.theme = mode;
    };

    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(media.matches ? 'dark' : 'light');
      const listener = (event: MediaQueryListEvent) => {
        applyTheme(event.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    applyTheme(themeMode);
  }, [themeMode]);

  const handleGoHome = () => {
    setGoHomeSignal((prev) => prev + 1);
  };

  return (
    <div className="app" style={{ '--app-nav-height': `${navHeight}px` } as React.CSSProperties}>
      <nav className="app-nav" ref={navRef}>
        <Link className="app-nav-brand" to="/" onClick={handleGoHome} title="All images">
          <span className="app-nav-title">ComfyUI Viewer</span>
          <span className="app-nav-version">v{packageJson.version}</span>
        </Link>
        <div className="app-nav-links">
          <NavLink to="/" end className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
            Gallery
          </NavLink>
          <NavLink to="/workflows" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
            Workflows
          </NavLink>
        </div>
      </nav>
      <div className="app-content">
        <Outlet context={{ themeMode, setThemeMode, goHomeSignal }} />
      </div>
    </div>
  );
}
