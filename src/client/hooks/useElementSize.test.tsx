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
        ref={(node) => {
          if (node) {
            vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
              width: 320,
              height: 180,
              top: 0,
              left: 0,
              right: 320,
              bottom: 180,
              x: 0,
              y: 0,
              toJSON: () => ({})
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
