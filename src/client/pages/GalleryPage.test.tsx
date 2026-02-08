import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GalleryPage from './GalleryPage';

vi.mock('../components/gallery/GalleryWorkspace', () => ({
  default: () => <div>Gallery Workspace Mock</div>
}));

describe('GalleryPage', () => {
  it('renders gallery workspace', () => {
    render(<GalleryPage />);
    expect(screen.getByText('Gallery Workspace Mock')).toBeInTheDocument();
  });
});
