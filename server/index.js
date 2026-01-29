import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import dotenv from 'dotenv';
import { DatabaseSync } from 'node:sqlite';

dotenv.config();

const DEFAULT_OUTPUT_DIR = '/var/lib/comfyui/output';
const DEFAULT_DATA_DIR = path.join(os.homedir(), 'comfy_viewer', 'data');
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.svg'
]);

const SOURCE_DIR = resolveDir(
  process.env.COMFY_OUTPUT_DIR || process.env.OUTPUT_DIR || DEFAULT_OUTPUT_DIR
);
const DATA_DIR = resolveDir(process.env.DATA_DIR || DEFAULT_DATA_DIR);
const THUMB_DIR = path.join(DATA_DIR, '.thumbs');
const LEGACY_DB_PATH = path.join(DATA_DIR, '.comfy_viewer.json');
const DB_PATH = path.join(DATA_DIR, '.comfy_viewer.sqlite');
const THUMB_MAX = Number(process.env.THUMB_MAX || 512);
const THUMB_QUALITY = Number(process.env.THUMB_QUALITY || 72);
const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 0);

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.SERVER_PORT || process.env.PORT || (isProd ? 8008 : 8009));

let sharpModule;

const app = express();
app.use(express.json({ limit: '1mb' }));

await ensureDir(DATA_DIR);
await ensureDir(THUMB_DIR);
const db = initDb();
const statements = prepareStatements(db);
await migrateLegacyDb();

app.use('/images', express.static(DATA_DIR));

app.get('/api/images', async (_req, res) => {
  try {
    const metadata = loadMetadata();
    const { images } = await listImages(DATA_DIR, metadata);
    res.json({
      images,
      sourceDir: SOURCE_DIR,
      dataDir: DATA_DIR
    });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to list images');
  }
});

app.post('/api/favorite', async (req, res) => {
  try {
    const { path: relPath, value } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    setFavorite(relPath, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update favorite');
  }
});

app.post('/api/favorite/bulk', async (req, res) => {
  try {
    const { paths, value } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    setBulkFavorite(paths, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update favorites');
  }
});

app.post('/api/hidden', async (req, res) => {
  try {
    const { path: relPath, value } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    setHidden(relPath, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update hidden state');
  }
});

app.post('/api/hidden/bulk', async (req, res) => {
  try {
    const { paths, value } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    setBulkHidden(paths, Boolean(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update hidden state');
  }
});

app.post('/api/tags', async (req, res) => {
  try {
    const { path: relPath, tags } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    const normalized = normalizeTags(tags);
    setTagsForPath(relPath, normalized);
    res.json({ ok: true, tags: normalized });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update tags');
  }
});

app.post('/api/tags/bulk', async (req, res) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).send('Missing updates');
    }
    setBulkTags(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update tags');
  }
});

app.post('/api/delete', async (req, res) => {
  try {
    const { path: relPath } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    const result = await deleteImageByPath(relPath);
    res.json(result);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to delete image');
  }
});

app.post('/api/delete/bulk', async (req, res) => {
  try {
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    const result = await deleteImagesByPath(paths);
    res.json(result);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to delete images');
  }
});

app.post('/api/sync', async (_req, res) => {
  try {
    const result = await syncSourceToData();
    res.json(result);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to sync');
  }
});

if (isProd) {
  const distPath = path.join(process.cwd(), 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

await syncSourceToData();

if (Number.isFinite(SYNC_INTERVAL_MS) && SYNC_INTERVAL_MS > 0) {
  setInterval(() => {
    syncSourceToData().catch((err) => {
      console.error('Auto-sync failed:', err);
    });
  }, SYNC_INTERVAL_MS);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
  console.log(`Source dir: ${SOURCE_DIR}`);
  console.log(`Data dir: ${DATA_DIR}`);
});

function resolveDir(input) {
  if (!input) return input;
  if (input.startsWith('~')) {
    return path.join(os.homedir(), input.slice(1));
  }
  return input;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function isImageFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function initDb() {
  const database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      path TEXT PRIMARY KEY,
      favorite INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tags (
      path TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (path, tag)
    );
    CREATE TABLE IF NOT EXISTS blacklist (
      hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );
  `);
  return database;
}

function prepareStatements(database) {
  return {
    selectMeta: database.prepare('SELECT path, favorite, hidden FROM meta'),
    selectTags: database.prepare('SELECT path, tag FROM tags ORDER BY path, tag'),
    upsertFavorite: database.prepare(
      'INSERT INTO meta (path, favorite) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET favorite = excluded.favorite'
    ),
    upsertHidden: database.prepare(
      'INSERT INTO meta (path, hidden) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET hidden = excluded.hidden'
    ),
    deleteMeta: database.prepare('DELETE FROM meta WHERE path = ?'),
    deleteTagsByPath: database.prepare('DELETE FROM tags WHERE path = ?'),
    insertTag: database.prepare('INSERT OR IGNORE INTO tags (path, tag) VALUES (?, ?)'),
    selectBlacklist: database.prepare('SELECT 1 FROM blacklist WHERE hash = ? LIMIT 1'),
    insertBlacklist: database.prepare(
      'INSERT OR IGNORE INTO blacklist (hash, created_at) VALUES (?, ?)'
    ),
    hasMeta: database.prepare('SELECT 1 FROM meta LIMIT 1'),
    hasTags: database.prepare('SELECT 1 FROM tags LIMIT 1')
  };
}

function runTransaction(task) {
  db.exec('BEGIN');
  try {
    const result = task();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function loadMetadata() {
  const favorites = new Map();
  const hidden = new Map();
  const tagsByPath = new Map();
  for (const row of statements.selectMeta.iterate()) {
    if (row.favorite) {
      favorites.set(row.path, true);
    }
    if (row.hidden) {
      hidden.set(row.path, true);
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
  return { favorites, hidden, tagsByPath };
}

function setFavorite(relPath, value) {
  statements.upsertFavorite.run(relPath, value ? 1 : 0);
}

function setHidden(relPath, value) {
  statements.upsertHidden.run(relPath, value ? 1 : 0);
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
  if (!existsSync(LEGACY_DB_PATH)) return;
  const hasMeta = statements.hasMeta.get();
  const hasTags = statements.hasTags.get();
  if (hasMeta || hasTags) return;
  try {
    const raw = await fs.readFile(LEGACY_DB_PATH, 'utf8');
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

async function listImages(root, metadata) {
  const images = [];

  if (!existsSync(root)) {
    return { images };
  }

  await walkDir(root, '', images, metadata);

  return { images };
}

async function walkDir(currentDir, relDir, images, metadata) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.comfy_viewer.json' || entry.name === '.comfy_viewer.sqlite') continue;
    if (entry.isDirectory() && entry.name === '.thumbs') continue;
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nextRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      await walkDir(entryPath, nextRel, images, metadata);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const thumbRel = relDir
        ? `${relDir}/${entry.name}.jpg`
        : `${entry.name}.jpg`;
      const thumbPath = path.join(THUMB_DIR, thumbRel);
      const thumbUrl = existsSync(thumbPath)
        ? `/images/.thumbs/${encodeURI(thumbRel)}`
        : undefined;
      const stats = await fs.stat(entryPath);
      const createdMs = Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0
        ? stats.birthtimeMs
        : Number.isFinite(stats.ctimeMs) && stats.ctimeMs > 0
          ? stats.ctimeMs
          : stats.mtimeMs;
      images.push({
        id: relPath,
        name: entry.name,
        url: `/images/${encodeURI(relPath)}`,
        thumbUrl,
        favorite: metadata.favorites.has(relPath),
        hidden: metadata.hidden.has(relPath),
        tags: metadata.tagsByPath.get(relPath) || [],
        createdMs,
        mtimeMs: stats.mtimeMs,
        size: stats.size
      });
    }
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

function resolvePathWithinRoot(rootDir, relPath) {
  const resolved = path.resolve(rootDir, relPath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid path');
  }
  return resolved;
}

function resolveDataPath(relPath) {
  return resolvePathWithinRoot(DATA_DIR, relPath);
}

function resolveSourcePath(relPath) {
  return resolvePathWithinRoot(SOURCE_DIR, relPath);
}

async function removeFileIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function deleteImageByPath(relPath) {
  const outcome = await deleteSingleImage(relPath);
  return {
    ok: true,
    deleted: outcome.deleted ? 1 : 0,
    blacklisted: outcome.blacklisted ? 1 : 0
  };
}

async function deleteImagesByPath(paths) {
  const results = [];
  for (const relPath of paths) {
    if (typeof relPath !== 'string' || !relPath) continue;
    const outcome = await deleteSingleImage(relPath);
    results.push(outcome);
  }
  const deleted = results.filter((entry) => entry.deleted).length;
  const blacklisted = results.filter((entry) => entry.blacklisted).length;
  return { ok: true, deleted, blacklisted };
}

async function deleteSingleImage(relPath) {
  const dataPath = resolveDataPath(relPath);
  const thumbPath = path.join(THUMB_DIR, `${relPath}.jpg`);
  let hash;
  if (existsSync(dataPath)) {
    hash = await hashFile(dataPath);
  } else {
    const sourcePath = resolveSourcePath(relPath);
    if (existsSync(sourcePath)) {
      hash = await hashFile(sourcePath);
    }
  }
  await removeFileIfExists(dataPath);
  await removeFileIfExists(thumbPath);
  if (hash) {
    addHashToBlacklist(hash);
  }
  statements.deleteTagsByPath.run(relPath);
  statements.deleteMeta.run(relPath);
  return { ok: true, deleted: true, blacklisted: Boolean(hash) };
}

async function syncSourceToData() {
  const result = { scanned: 0, copied: 0, thumbnails: 0 };
  if (!existsSync(SOURCE_DIR)) {
    return result;
  }
  await copyImages(SOURCE_DIR, DATA_DIR, result);
  return result;
}

async function copyImages(sourceDir, targetDir, result, rel = '') {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const nextRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === '.thumbs') continue;
      await copyImages(sourcePath, targetDir, result, nextRel);
    } else if (entry.isFile() && isImageFile(entry.name)) {
      result.scanned += 1;
      const targetPath = path.join(targetDir, nextRel);
      await ensureDir(path.dirname(targetPath));
      const sourceStat = await fs.stat(sourcePath);
      let targetStat;
      let targetExists = false;
      let shouldCopy = true;
      try {
        targetStat = await fs.stat(targetPath);
        targetExists = true;
        if (targetStat.mtimeMs >= sourceStat.mtimeMs && targetStat.size === sourceStat.size) {
          shouldCopy = false;
        }
      } catch {
        shouldCopy = true;
      }
      if (shouldCopy) {
        const hash = await hashFile(sourcePath);
        if (isHashBlacklisted(hash)) {
          await removeFileIfExists(targetPath);
          await removeFileIfExists(path.join(THUMB_DIR, `${nextRel}.jpg`));
          continue;
        }
        await fs.copyFile(sourcePath, targetPath);
        result.copied += 1;
        targetStat = await fs.stat(targetPath);
        targetExists = true;
      }
      if (targetExists) {
        await ensureThumbnail(targetPath, nextRel, targetStat, result);
      }
    }
  }
}

async function getSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default ?? mod;
  } catch (err) {
    console.warn('Sharp not available, thumbnails disabled.', err);
    sharpModule = null;
  }
  return sharpModule;
}

async function ensureThumbnail(targetPath, relPath, sourceStat, result) {
  const thumbPath = path.join(THUMB_DIR, `${relPath}.jpg`);
  await ensureDir(path.dirname(thumbPath));
  let shouldGenerate = true;
  try {
    const thumbStat = await fs.stat(thumbPath);
    if (thumbStat.mtimeMs >= sourceStat.mtimeMs) {
      shouldGenerate = false;
    }
  } catch {
    shouldGenerate = true;
  }
  if (!shouldGenerate) return;
  const sharp = await getSharp();
  if (!sharp) return;
  await sharp(targetPath)
    .rotate()
    .resize({
      width: THUMB_MAX,
      height: THUMB_MAX,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: THUMB_QUALITY })
    .toFile(thumbPath);
  result.thumbnails += 1;
}
