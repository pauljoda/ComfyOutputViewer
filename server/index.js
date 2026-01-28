import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import dotenv from 'dotenv';

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
const DB_PATH = path.join(DATA_DIR, '.comfy_viewer.json');
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

app.use('/images', express.static(DATA_DIR));

app.get('/api/images', async (_req, res) => {
  try {
    const db = await readDb();
    const { images, folders } = await listImages(DATA_DIR, db);
    res.json({
      images,
      folders,
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
    const db = await readDb();
    if (value) {
      db.favorites[relPath] = true;
    } else {
      delete db.favorites[relPath];
    }
    await writeDb(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update favorite');
  }
});

app.post('/api/hidden', async (req, res) => {
  try {
    const { path: relPath, value } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    const db = await readDb();
    if (value) {
      db.hidden[relPath] = true;
    } else {
      delete db.hidden[relPath];
    }
    await writeDb(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update hidden state');
  }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { path: relPath } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    const target = safeResolve(DATA_DIR, relPath);
    await ensureDir(target);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to create folder');
  }
});

app.post('/api/move', async (req, res) => {
  try {
    const { path: relPath, targetFolder } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    const fromPath = safeResolve(DATA_DIR, relPath);
    const destFolder = safeResolve(DATA_DIR, targetFolder || '');
    const destPath = path.join(destFolder, path.basename(relPath));
    await ensureDir(destFolder);
    await fs.rename(fromPath, destPath);
    await moveFavorite(relPath, toPosix(path.relative(DATA_DIR, destPath)));
    await moveHidden(relPath, toPosix(path.relative(DATA_DIR, destPath)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to move image');
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

function toPosix(input) {
  return input.split(path.sep).join('/');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function isImageFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function safeResolve(baseDir, target) {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(baseDir, target);
  const baseWithSep = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  if (resolved !== base && !resolved.startsWith(baseWithSep)) {
    throw new Error('Invalid path');
  }
  return resolved;
}

async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      favorites: parsed.favorites || {},
      hidden: parsed.hidden || {}
    };
  } catch {
    return { favorites: {}, hidden: {} };
  }
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

async function moveFavorite(fromRel, toRel) {
  if (fromRel === toRel) return;
  const db = await readDb();
  if (db.favorites[fromRel]) {
    delete db.favorites[fromRel];
    db.favorites[toRel] = true;
    await writeDb(db);
  }
}

async function moveHidden(fromRel, toRel) {
  if (fromRel === toRel) return;
  const db = await readDb();
  if (db.hidden[fromRel]) {
    delete db.hidden[fromRel];
    db.hidden[toRel] = true;
    await writeDb(db);
  }
}

async function listImages(root, db) {
  const images = [];
  const folders = new Set();

  if (!existsSync(root)) {
    return { images, folders: [] };
  }

  await walkDir(root, '', images, folders, db);

  return {
    images,
    folders: Array.from(folders).sort()
  };
}

async function walkDir(currentDir, relDir, images, folders, db) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.comfy_viewer.json') continue;
    if (entry.isDirectory() && entry.name === '.thumbs') continue;
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nextRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      folders.add(nextRel);
      await walkDir(entryPath, nextRel, images, folders, db);
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
      images.push({
        id: relPath,
        name: entry.name,
        folder: relDir,
        url: `/images/${encodeURI(relPath)}`,
        thumbUrl,
        favorite: Boolean(db.favorites[relPath]),
        hidden: Boolean(db.hidden[relPath]),
        mtimeMs: stats.mtimeMs,
        size: stats.size
      });
    }
  }
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
      const targetPath = path.join(targetDir, nextRel);
      await ensureDir(path.dirname(targetPath));
      let shouldCopy = true;
      const sourceStat = await fs.stat(sourcePath);
      let targetStat = sourceStat;
      try {
        targetStat = await fs.stat(targetPath);
        if (targetStat.mtimeMs >= sourceStat.mtimeMs && targetStat.size === sourceStat.size) {
          shouldCopy = false;
        }
      } catch {
        shouldCopy = true;
      }
      if (shouldCopy) {
        await fs.copyFile(sourcePath, targetPath);
        result.copied += 1;
        targetStat = await fs.stat(targetPath);
      }
      await ensureThumbnail(targetPath, nextRel, targetStat, result);
      result.scanned += 1;
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
