import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

function setupMatchMedia(initialMatches: boolean) {
  let listener = null;
  const mediaQueryList = {
    matches: initialMatches,
    media: '(max-width: 900px)',
    onchange: null,
    addEventListener: vi.fn((_event, cb) => {
      listener = cb;
    }),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQueryList));
  return {
    setMatches(value: boolean) {
      mediaQueryList.matches = value;
      listener?.({ matches: value });
    }
  };
}

function QueryComponent() {
  const matches = useMediaQuery('(max-width: 900px)');
  return <span data-testid="value">{String(matches)}</span>;
}

describe('useMediaQuery', () => {
  it('tracks media query match changes', () => {
    const media = setupMatchMedia(false);
    render(<QueryComponent />);
    expect(screen.getByTestId('value')).toHaveTextContent('false');

    act(() => {
      media.setMatches(true);
    });

    expect(screen.getByTestId('value')).toHaveTextContent('true');
  });
});
