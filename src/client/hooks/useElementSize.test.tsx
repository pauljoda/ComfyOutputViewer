import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useElementSize } from './useElementSize';

let resizeCallback = null;

class TestResizeObserver {
  constructor(callback) {
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
        style={{ padding: '10px 12px' }}
        ref={(node) => {
          if (node) {
            Object.defineProperty(node, 'clientWidth', {
              configurable: true,
              value: 344
            });
            Object.defineProperty(node, 'clientHeight', {
              configurable: true,
              value: 200
            });
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
    render(<ElementSizeComponent />);
    expect(screen.getByTestId('size')).toHaveTextContent('320x180');
  });
});
