import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.fn();

vi.mock('../lib/api', () => ({
  api: (...args) => apiMock(...args)
}));

import { TagsProvider, useTags } from './TagsContext';

function Consumer() {
  const { availableTags, tagCounts, updateFromImages, refreshTags } = useTags();
  return (
    <div>
      <div data-testid="tags">{availableTags.join(',')}</div>
      <div data-testid="counts">{tagCounts.map((entry) => `${entry.tag}:${entry.count}`).join(',')}</div>
      <button
        type="button"
        onClick={() =>
          updateFromImages([
            {
              id: '1',
              name: 'a',
              url: '/a',
              favorite: false,
              hidden: false,
              rating: 0,
              tags: ['portrait', 'night'],
              createdMs: 1,
              mtimeMs: 1,
              size: 1
            },
            {
              id: '2',
              name: 'b',
              url: '/b',
              favorite: false,
              hidden: false,
              rating: 0,
              tags: ['portrait'],
              createdMs: 1,
              mtimeMs: 1,
              size: 1
            }
          ])
        }
      >
        update
      </button>
      <button type="button" onClick={() => refreshTags()}>
        refresh
      </button>
    </div>
  );
}

describe('TagsContext', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('builds tag counts from images supplied by updateFromImages', () => {
    apiMock.mockResolvedValueOnce({ images: [], sourceDir: '', dataDir: '' });
    render(
      <TagsProvider>
        <Consumer />
      </TagsProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'update' }).click();
    });

    expect(screen.getByTestId('tags')).toHaveTextContent('portrait,night');
    expect(screen.getByTestId('counts')).toHaveTextContent('portrait:2,night:1');
  });

  it('refreshes tags from the api and normalizes values', async () => {
    apiMock.mockResolvedValue({
      images: [
        {
          id: 'x',
          name: 'x',
          url: '/x',
          favorite: false,
          hidden: false,
          rating: 0,
          tags: ['  Portrait ', 'portrait', 'Night'],
          createdMs: 1,
          mtimeMs: 1,
          size: 1
        }
      ],
      sourceDir: '',
      dataDir: ''
    });
    render(
      <TagsProvider>
        <Consumer />
      </TagsProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: 'refresh' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('tags')).toHaveTextContent('night,portrait');
    });
  });
});
