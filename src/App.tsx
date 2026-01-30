import React, { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import packageJson from '../package.json';
import { STORAGE_KEYS } from './constants';
import type { ThemeMode } from './types';

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  });

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

  return (
    <div className="app">
      <nav className="app-nav">
        <div className="app-nav-brand">
          <span className="app-nav-title">ComfyUI Viewer</span>
          <span className="app-nav-version">v{packageJson.version}</span>
        </div>
        <div className="app-nav-links">
          <NavLink to="/" end className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
            Gallery
          </NavLink>
          <NavLink to="/workflows" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
            Workflows
          </NavLink>
        </div>
        <div className="app-nav-actions">
          <select
            className="theme-select"
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </nav>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
