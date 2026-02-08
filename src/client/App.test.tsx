import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import type { ThemeMode } from './types';

function OutletProbe() {
  const { goHomeSignal } = useOutletContext<{
    themeMode: ThemeMode;
    setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
    goHomeSignal: number;
  }>();
  return <div data-testid="go-home-signal">{goHomeSignal}</div>;
}

describe('App shell', () => {
  it('renders nav links and sends goHome signal when brand is clicked', () => {
    window.localStorage.setItem('cov_theme', 'light');
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );

    render(<MemoryRouterWithRoutes />);

    expect(screen.getByRole('link', { name: /gallery/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /workflows/i })).toBeInTheDocument();
    expect(screen.getByTestId('go-home-signal')).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('link', { name: /comfyui viewer/i }));
    expect(screen.getByTestId('go-home-signal')).toHaveTextContent('1');
  });
});

function MemoryRouterWithRoutes() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<App />}>
          <Route index element={<OutletProbe />} />
          <Route path="workflows" element={<OutletProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
