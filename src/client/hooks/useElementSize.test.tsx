import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useElementSize } from './useElementSize';

let resizeCallback: ((entries: any[]) => void) | null = null;

class TestResizeObserver {
  constructor(callback: (entries: any[]) => void) {
    resizeCallback = callback;
  }

  observe() {}

  unobserve() {}

  disconnect() {}
}

function ElementSizeComponent() {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  return (
    <div>
      <div
        ref={(node) => {
          if (node) {
            Object.defineProperty(node, 'clientWidth', { value: 320, configurable: true });
            Object.defineProperty(node, 'clientHeight', { value: 180, configurable: true });
            vi.spyOn(window, 'getComputedStyle').mockReturnValue({
              paddingLeft: '0',
              paddingRight: '0',
              paddingTop: '0',
              paddingBottom: '0'
            } as unknown as CSSStyleDeclaration);
          }
          ref(node);
        }}
      />
      <span data-testid="size">{`${width}x${height}`}</span>
    </div>
  );
}

describe('useElementSize', () => {
  it('measures element size on mount', () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      cb();
      return 0;
    });
    try {
      render(<ElementSizeComponent />);
      expect(screen.getByTestId('size')).toHaveTextContent('320x180');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
