import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import packageJson from '../../package.json';
import { STORAGE_KEYS } from './constants';
import type { ThemeMode } from './types';
import { useElementSize } from './hooks/useElementSize';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { enumSerializer } from './utils/storage';

const themeSerializer = enumSerializer<ThemeMode>('system', ['system', 'light', 'dark']);

export default function App() {
  const [themeMode, setThemeMode] = useLocalStorageState(
    STORAGE_KEYS.theme,
    'system',
    themeSerializer
  );
  const [goHomeSignal, setGoHomeSignal] = useState(0);
  const { ref: navRef, height: navHeight } = useElementSize<HTMLElement>();

  useEffect(() => {
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

  const resolvedTheme = themeMode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;

  const cycleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    setThemeMode(next);
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
        <div className="app-nav-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={cycleTheme}
            aria-label={`Theme: ${themeMode}`}
            title={`Theme: ${themeMode}`}
          >
            {resolvedTheme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>
        </div>
      </nav>
      <div className="app-content">
        <Outlet context={{ themeMode, setThemeMode, goHomeSignal }} />
      </div>
    </div>
  );
}
