import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RatingStars from './RatingStars';

describe('RatingStars', () => {
  it('calls onChange with selected rating and supports clear', () => {
    const onChange = vi.fn();
    render(<RatingStars value={3} onChange={onChange} allowClear />);

    fireEvent.click(screen.getByRole('button', { name: /set rating to 5 stars/i }));
    expect(onChange).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole('button', { name: /set rating to 3 stars/i }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('does not emit changes when disabled', () => {
    const onChange = vi.fn();
    render(<RatingStars value={2} onChange={onChange} disabled />);

    fireEvent.click(screen.getByRole('button', { name: /set rating to 4 stars/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
