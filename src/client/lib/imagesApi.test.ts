import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiJsonMock = vi.fn(async () => ({ ok: true }));

vi.mock('./api', () => ({
  apiJson: (...args) => apiJsonMock(...args)
}));

import {
  bulkDelete,
  bulkFavorite,
  bulkHidden,
  bulkRating,
  bulkTags,
  deleteImage,
  setFavorite,
  setHidden,
  setRating,
  setTags
} from './imagesApi';

describe('imagesApi wrappers', () => {
  beforeEach(() => {
    apiJsonMock.mockClear();
  });

  it('calls correct endpoints with expected payloads', async () => {
    await setFavorite('a.png', true);
    await setHidden('a.png', true);
    await setRating('a.png', 4);
    await setTags('a.png', ['night']);
    await deleteImage('a.png');
    await bulkFavorite(['a.png'], true);
    await bulkHidden(['a.png'], true);
    await bulkRating(['a.png'], 5);
    await bulkTags([{ path: 'a.png', tags: ['night'] }]);
    await bulkDelete(['a.png']);

    expect(apiJsonMock).toHaveBeenCalledWith('/api/favorite', { body: { path: 'a.png', value: true } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/hidden', { body: { path: 'a.png', value: true } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/rating', { body: { path: 'a.png', value: 4 } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/tags', { body: { path: 'a.png', tags: ['night'] } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/delete', { body: { path: 'a.png' } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/favorite/bulk', { body: { paths: ['a.png'], value: true } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/hidden/bulk', { body: { paths: ['a.png'], value: true } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/rating/bulk', { body: { paths: ['a.png'], value: 5 } });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/tags/bulk', {
      body: { updates: [{ path: 'a.png', tags: ['night'] }] }
    });
    expect(apiJsonMock).toHaveBeenCalledWith('/api/delete/bulk', { body: { paths: ['a.png'] } });
  });
});
