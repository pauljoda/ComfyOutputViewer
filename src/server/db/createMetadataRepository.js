export function createMetadataRepository({
  statements,
  runTransaction,
  fs,
  existsSync,
  legacyDbPath,
  ratingMin = 0,
  ratingMax = 5
}) {
  function loadMetadata() {
    const favorites = new Map();
    const hidden = new Map();
    const ratings = new Map();
    const tagsByPath = new Map();
    for (const row of statements.selectMeta.iterate()) {
      if (row.favorite) {
        favorites.set(row.path, true);
      }
      if (row.hidden) {
        hidden.set(row.path, true);
      }
      if (Number.isFinite(row.rating)) {
        ratings.set(row.path, row.rating);
      }
    }
    for (const row of statements.selectTags.iterate()) {
      const existing = tagsByPath.get(row.path);
      if (existing) {
        existing.push(row.tag);
      } else {
        tagsByPath.set(row.path, [row.tag]);
      }
    }
    return { favorites, hidden, ratings, tagsByPath };
  }

  function setFavorite(relPath, value) {
    statements.upsertFavorite.run(relPath, value ? 1 : 0);
  }

  function setHidden(relPath, value) {
    statements.upsertHidden.run(relPath, value ? 1 : 0);
  }

  function setRating(relPath, value) {
    statements.upsertRating.run(relPath, value);
  }

  function setBulkFavorite(paths, value) {
    runTransaction(() => {
      for (const relPath of paths) {
        if (typeof relPath !== 'string' || !relPath) continue;
        statements.upsertFavorite.run(relPath, value ? 1 : 0);
      }
    });
  }

  function setBulkHidden(paths, value) {
    runTransaction(() => {
      for (const relPath of paths) {
        if (typeof relPath !== 'string' || !relPath) continue;
        statements.upsertHidden.run(relPath, value ? 1 : 0);
      }
    });
  }

  function setBulkRating(paths, value) {
    runTransaction(() => {
      for (const relPath of paths) {
        if (typeof relPath !== 'string' || !relPath) continue;
        statements.upsertRating.run(relPath, value);
      }
    });
  }

  function setTagsForPath(relPath, tags) {
    runTransaction(() => {
      statements.deleteTagsByPath.run(relPath);
      for (const tag of tags) {
        statements.insertTag.run(relPath, tag);
      }
    });
  }

  function setBulkTags(updates) {
    runTransaction(() => {
      for (const update of updates) {
        if (!update || typeof update.path !== 'string' || !update.path) continue;
        const normalized = normalizeTags(update.tags);
        statements.deleteTagsByPath.run(update.path);
        for (const tag of normalized) {
          statements.insertTag.run(update.path, tag);
        }
      }
    });
  }

  function addHashToBlacklist(hash) {
    statements.insertBlacklist.run(hash, Date.now());
  }

  function isHashBlacklisted(hash) {
    return Boolean(statements.selectBlacklist.get(hash));
  }

  async function migrateLegacyDb() {
    if (!existsSync(legacyDbPath)) return;
    const hasMeta = statements.hasMeta.get();
    const hasTags = statements.hasTags.get();
    if (hasMeta || hasTags) return;

    try {
      const raw = await fs.readFile(legacyDbPath, 'utf8');
      const parsed = JSON.parse(raw);
      runTransaction(() => {
        for (const [relPath, value] of Object.entries(parsed.favorites || {})) {
          if (!value) continue;
          statements.upsertFavorite.run(relPath, 1);
        }
        for (const [relPath, value] of Object.entries(parsed.hidden || {})) {
          if (!value) continue;
          statements.upsertHidden.run(relPath, 1);
        }
        for (const [relPath, value] of Object.entries(parsed.ratings || {})) {
          if (value === undefined || value === null) continue;
          const rating = normalizeRating(value);
          if (!rating) continue;
          statements.upsertRating.run(relPath, rating);
        }
        for (const [relPath, tags] of Object.entries(parsed.tags || {})) {
          const normalized = normalizeTags(tags);
          if (!normalized.length) continue;
          statements.deleteTagsByPath.run(relPath);
          for (const tag of normalized) {
            statements.insertTag.run(relPath, tag);
          }
        }
      });
      console.log('Migrated legacy JSON metadata into SQLite.');
    } catch (err) {
      console.warn('Failed to migrate legacy JSON metadata.', err);
    }
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    const tagMap = new Map();
    for (const entry of tags) {
      if (typeof entry !== 'string') continue;
      const trimmed = entry.trim().replace(/\s+/g, ' ');
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!tagMap.has(key)) {
        tagMap.set(key, key);
      }
    }
    return Array.from(tagMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }

  function normalizeRating(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return ratingMin;
    const rounded = Math.round(parsed);
    return Math.max(ratingMin, Math.min(ratingMax, rounded));
  }

  return {
    loadMetadata,
    setFavorite,
    setHidden,
    setRating,
    setBulkFavorite,
    setBulkHidden,
    setBulkRating,
    setTagsForPath,
    setBulkTags,
    addHashToBlacklist,
    isHashBlacklisted,
    migrateLegacyDb,
    normalizeTags,
    normalizeRating
  };
}
