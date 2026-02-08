import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { Button } from './components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import packageJson from '../../package.json';
import { STORAGE_KEYS } from './constants';
import type { ThemeMode } from './types';
import { useElementSize } from './hooks/useElementSize';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { enumSerializer, stringSerializer } from './utils/storage';

const themeSerializer = enumSerializer<ThemeMode>('system', ['system', 'light', 'dark']);
const accentSerializer = stringSerializer('#f97316');

function hslFromHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function App() {
  const [themeMode, setThemeMode] = useLocalStorageState(
    STORAGE_KEYS.theme,
    'system',
    themeSerializer
  );
  const [accentColor, setAccentColor] = useLocalStorageState(
    STORAGE_KEYS.accentColor,
    '#f97316',
    accentSerializer
  );
  const [goHomeSignal, setGoHomeSignal] = useState(0);
  const { ref: navRef, height: navHeight } = useElementSize<HTMLElement>();

  useEffect(() => {
    const root = document.documentElement;
    const syncBrowserTheme = (mode: 'light' | 'dark') => {
      root.style.colorScheme = mode;
      const themeColor = mode === 'dark' ? '#0b0b0f' : '#ffffff';
      let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.append(metaTheme);
      }
      metaTheme.content = themeColor;
    };
    const applyTheme = (mode: 'light' | 'dark') => {
      root.classList.toggle('dark', mode === 'dark');
      syncBrowserTheme(mode);
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

  useEffect(() => {
    const hsl = hslFromHex(accentColor);
    const root = document.documentElement.style;
    root.setProperty('--primary', hsl);
    root.setProperty('--ring', hsl);
    root.setProperty('--sidebar-primary', hsl);
    root.setProperty('--sidebar-ring', hsl);
    // Derive accent tint from primary hue+saturation
    const parts = hsl.split(' ');
    const h = parts[0];
    const s = parts[1];
    const isDark = document.documentElement.classList.contains('dark');
    root.setProperty('--accent', `${h} ${s} ${isDark ? '20%' : '95%'}`);
    root.setProperty('--sidebar-accent', `${h} ${s} ${isDark ? '20%' : '95%'}`);
  }, [accentColor, themeMode]);

  const handleGoHome = () => {
    setGoHomeSignal((prev) => prev + 1);
  };

  return (
    <div className="flex h-full flex-col" style={{ '--app-nav-height': `${navHeight}px` } as React.CSSProperties}>
      <nav
        ref={navRef}
        className="sticky top-0 z-50 flex items-center gap-4 border-b bg-background/95 px-4 py-2 backdrop-blur-sm"
      >
        <Link
          to="/"
          onClick={handleGoHome}
          title="All images"
          className="flex items-baseline gap-2 text-foreground no-underline hover:opacity-80"
        >
          <span className="text-sm font-semibold">ComfyUI Viewer</span>
          <span className="text-xs text-muted-foreground">v{packageJson.version}</span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink to="/" end>
            {({ isActive }) => (
              <Button variant={isActive ? 'secondary' : 'ghost'} size="sm" className={isActive ? 'text-primary' : ''}>
                Gallery
              </Button>
            )}
          </NavLink>
          <NavLink to="/workflows">
            {({ isActive }) => (
              <Button variant={isActive ? 'secondary' : 'ghost'} size="sm" className={isActive ? 'text-primary' : ''}>
                Workflows
              </Button>
            )}
          </NavLink>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Theme" aria-label="Theme">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Theme</div>
              <div className="flex gap-1">
                {([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([mode, Icon]) => (
                  <Button
                    key={mode}
                    variant={themeMode === mode ? 'secondary' : 'ghost'}
                    size="sm"
                    className="flex-1 gap-1.5 capitalize"
                    onClick={() => setThemeMode(mode)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {mode}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Accent</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="text-xs text-muted-foreground">{accentColor}</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <Outlet context={{ themeMode, setThemeMode, goHomeSignal }} />
      </div>
    </div>
  );
}
