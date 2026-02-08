import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBar from './StatusBar';

describe('StatusBar', () => {
  it('shows loading and error states', () => {
    const { rerender } = render(
      <StatusBar loading imageCount={0} status="Syncing..." error={null} />
    );
    expect(screen.getByText('Loading images…')).toBeInTheDocument();
    expect(screen.getByText('Syncing...')).toBeInTheDocument();

    rerender(<StatusBar loading={false} imageCount={12} status="" error="Failed" />);
    expect(screen.getByText('12 images')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
