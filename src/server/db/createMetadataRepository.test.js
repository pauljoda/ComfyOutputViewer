import { describe, expect, it, vi } from 'vitest';
import { createMetadataRepository } from './createMetadataRepository.js';
import { makeGet, makeIterable, makeRun } from '../test/helpers.js';

function createStatements(overrides = {}) {
  return {
    selectMeta: makeIterable([]),
    selectTags: makeIterable([]),
    upsertFavorite: makeRun(),
    upsertHidden: makeRun(),
    upsertRating: makeRun(),
    deleteTagsByPath: makeRun(),
    insertTag: makeRun(),
    insertBlacklist: makeRun(),
    selectBlacklist: makeGet(() => null),
    hasMeta: makeGet(() => null),
    hasTags: makeGet(() => null),
    ...overrides
  };
}

describe('createMetadataRepository', () => {
  it('loads favorites/hidden/ratings/tags from statements', () => {
    const statements = createStatements({
      selectMeta: makeIterable([
        { path: 'a.png', favorite: 1, hidden: 0, rating: 4 },
        { path: 'b.png', favorite: 0, hidden: 1, rating: 0 }
      ]),
      selectTags: makeIterable([
        { path: 'a.png', tag: 'portrait' },
        { path: 'a.png', tag: 'night' }
      ])
    });
    const repo = createMetadataRepository({
      statements,
      runTransaction: (fn) => fn(),
      fs: { readFile: vi.fn() },
      existsSync: vi.fn(() => false),
      legacyDbPath: '/tmp/legacy.json'
    });

    const metadata = repo.loadMetadata();
    expect(metadata.favorites.get('a.png')).toBe(true);
    expect(metadata.hidden.get('b.png')).toBe(true);
    expect(metadata.ratings.get('a.png')).toBe(4);
    expect(metadata.tagsByPath.get('a.png')).toEqual(['portrait', 'night']);
  });

  it('normalizes tags and ratings', () => {
    const repo = createMetadataRepository({
      statements: createStatements(),
      runTransaction: (fn) => fn(),
      fs: { readFile: vi.fn() },
      existsSync: vi.fn(() => false),
      legacyDbPath: '/tmp/legacy.json',
      ratingMin: 0,
      ratingMax: 5
    });

    expect(repo.normalizeTags(['  Portrait  ', 'portrait', 'night sky', '', 4])).toEqual([
      'night sky',
      'portrait'
    ]);
    expect(repo.normalizeRating('4.7')).toBe(5);
    expect(repo.normalizeRating(-3)).toBe(0);
    expect(repo.normalizeRating('not-a-number')).toBe(0);
  });

  it('applies bulk tags in a transaction', () => {
    const runTransaction = vi.fn((fn) => fn());
    const statements = createStatements();
    const repo = createMetadataRepository({
      statements,
      runTransaction,
      fs: { readFile: vi.fn() },
      existsSync: vi.fn(() => false),
      legacyDbPath: '/tmp/legacy.json'
    });

    repo.setBulkTags([
      { path: 'a.png', tags: ['portrait', 'Portrait', ' day '] },
      { path: '', tags: ['skip'] }
    ]);

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(statements.deleteTagsByPath.run).toHaveBeenCalledWith('a.png');
    expect(statements.insertTag.run).toHaveBeenCalledWith('a.png', 'day');
    expect(statements.insertTag.run).toHaveBeenCalledWith('a.png', 'portrait');
  });

  it('migrates legacy json metadata when sqlite tables are empty', async () => {
    const runTransaction = vi.fn((fn) => fn());
    const statements = createStatements({
      hasMeta: makeGet(() => null),
      hasTags: makeGet(() => null)
    });
    const repo = createMetadataRepository({
      statements,
      runTransaction,
      fs: {
        readFile: vi.fn(async () =>
          JSON.stringify({
            favorites: { 'fav.png': true, 'skip.png': false },
            hidden: { 'hide.png': true },
            ratings: { 'rate.png': 3.4 },
            tags: { 'tag.png': ['  Portrait ', 'portrait'] }
          })
        )
      },
      existsSync: vi.fn(() => true),
      legacyDbPath: '/tmp/legacy.json'
    });

    await repo.migrateLegacyDb();

    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(statements.upsertFavorite.run).toHaveBeenCalledWith('fav.png', 1);
    expect(statements.upsertHidden.run).toHaveBeenCalledWith('hide.png', 1);
    expect(statements.upsertRating.run).toHaveBeenCalledWith('rate.png', 3);
    expect(statements.insertTag.run).toHaveBeenCalledWith('tag.png', 'portrait');
  });
});
