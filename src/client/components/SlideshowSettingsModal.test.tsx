import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SlideshowSettingsModal from './SlideshowSettingsModal';

describe('SlideshowSettingsModal', () => {
  it('starts slideshow with selected settings', () => {
    const onStart = vi.fn();
    const onClose = vi.fn();
    render(<SlideshowSettingsModal imageCount={12} onStart={onStart} onClose={onClose} />);

    fireEvent.click(screen.getByText(/shuffled/i));
    fireEvent.click(screen.getByText(/range/i));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Min' }), { target: { value: '6' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Max' }), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /start slideshow/i }));

    expect(onStart).toHaveBeenCalledWith({
      order: 'shuffle',
      mode: 'random',
      fixedInterval: 5,
      minInterval: 4,
      maxInterval: 4,
      showProgress: true
    });
  });

  it('closes on overlay click', () => {
    const onClose = vi.fn();
    render(<SlideshowSettingsModal imageCount={2} onStart={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close slideshow settings/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
