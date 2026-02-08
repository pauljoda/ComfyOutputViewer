import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLocalStorageState } from './useLocalStorageState';
import { numberSerializer } from '../utils/storage';

function TestComponent({ storageKey }: { storageKey: string }) {
  const [value, setValue] = useLocalStorageState(
    storageKey,
    2,
    numberSerializer(2, { min: 0, max: 10, round: true })
  );
  return (
    <div>
      <span data-testid="value">{value}</span>
      <button type="button" onClick={() => setValue(7)}>
        set
      </button>
    </div>
  );
}

describe('useLocalStorageState', () => {
  it('reads from localStorage and writes on updates', () => {
    window.localStorage.setItem('rating', '4');
    render(<TestComponent storageKey="rating" />);

    expect(screen.getByTestId('value')).toHaveTextContent('4');

    act(() => {
      screen.getByRole('button', { name: 'set' }).click();
    });

    expect(window.localStorage.getItem('rating')).toBe('7');
    expect(screen.getByTestId('value')).toHaveTextContent('7');
  });

  it('falls back when storage value is invalid', () => {
    window.localStorage.setItem('rating-fallback', 'invalid');
    render(<TestComponent storageKey="rating-fallback" />);
    expect(screen.getByTestId('value')).toHaveTextContent('2');
  });
});
