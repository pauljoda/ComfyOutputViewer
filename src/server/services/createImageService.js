export function createImageService({
  path,
  fs,
  createHash,
  createReadStream,
  existsSync,
  imageExtensions,
  dataDir,
  sourceDir,
  thumbDir,
  inputsDir,
  thumbMax,
  thumbQuality,
  statements,
  addHashToBlacklist,
  isHashBlacklisted
}) {
  let sharpModule;

  async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  function isImageFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return imageExtensions.has(ext);
  }

  function resolveImageExtension(originalName, contentType) {
    const ext = path.extname(originalName || '').toLowerCase();
    if (imageExtensions.has(ext)) return ext;
    const type = (contentType || '').split(';')[0].trim().toLowerCase();
    switch (type) {
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      case 'image/bmp':
        return '.bmp';
      case 'image/tiff':
        return '.tiff';
      case 'image/svg+xml':
        return '.svg';
      default:
        return '';
    }
  }

  async function findExistingInputByHash(hash) {
    try {
      const entries = await fs.readdir(inputsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.startsWith(`${hash}.`)) continue;
        if (!isImageFile(entry.name)) continue;
        return entry.name;
      }
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
    return null;
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
        const thumbUrl = getThumbUrl(relPath);
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
          rating: metadata.ratings.get(relPath) ?? 0,
          tags: metadata.tagsByPath.get(relPath) || [],
          createdMs,
          mtimeMs: stats.mtimeMs,
          size: stats.size
        });
      }
    }
  }

  function getThumbUrl(relPath) {
    const thumbRel = `${relPath}.jpg`;
    const thumbPath = path.join(thumbDir, thumbRel);
    return existsSync(thumbPath) ? `/images/.thumbs/${encodeURI(thumbRel)}` : undefined;
  }

  async function buildImageItem(relPath, metadata) {
    const fullPath = resolveDataPath(relPath);
    if (!existsSync(fullPath)) return null;
    const stats = await fs.stat(fullPath);
    const createdMs = Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0
      ? stats.birthtimeMs
      : Number.isFinite(stats.ctimeMs) && stats.ctimeMs > 0
        ? stats.ctimeMs
        : stats.mtimeMs;
    return {
      id: relPath,
      name: path.basename(relPath),
      url: `/images/${encodeURI(relPath)}`,
      thumbUrl: getThumbUrl(relPath),
      favorite: metadata.favorites.has(relPath),
      hidden: metadata.hidden.has(relPath),
      rating: metadata.ratings.get(relPath) ?? 0,
      tags: metadata.tagsByPath.get(relPath) || [],
      createdMs,
      mtimeMs: stats.mtimeMs,
      size: stats.size
    };
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
    return resolvePathWithinRoot(dataDir, relPath);
  }

  function resolveSourcePath(relPath) {
    return resolvePathWithinRoot(sourceDir, relPath);
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
    const thumbPath = path.join(thumbDir, `${relPath}.jpg`);
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
    if (!existsSync(sourceDir)) {
      return result;
    }
    await copyImages(sourceDir, dataDir, result);
    return result;
  }

  async function copyImages(sourcePath, targetDir, result, rel = '') {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
      const sourceFilePath = path.join(sourcePath, entry.name);
      const nextRel = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === '.thumbs') continue;
        await copyImages(sourceFilePath, targetDir, result, nextRel);
      } else if (entry.isFile() && isImageFile(entry.name)) {
        result.scanned += 1;
        const targetPath = path.join(targetDir, nextRel);
        await ensureDir(path.dirname(targetPath));
        const sourceStat = await fs.stat(sourceFilePath);
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
          const hash = await hashFile(sourceFilePath);
          if (isHashBlacklisted(hash)) {
            await removeFileIfExists(targetPath);
            await removeFileIfExists(path.join(thumbDir, `${nextRel}.jpg`));
            continue;
          }
          await fs.copyFile(sourceFilePath, targetPath);
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
    const thumbPath = path.join(thumbDir, `${relPath}.jpg`);
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
        width: thumbMax,
        height: thumbMax,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: thumbQuality })
      .toFile(thumbPath);
    result.thumbnails += 1;
  }

  return {
    ensureDir,
    resolveImageExtension,
    findExistingInputByHash,
    listImages,
    getThumbUrl,
    buildImageItem,
    resolveDataPath,
    resolveSourcePath,
    removeFileIfExists,
    hashFile,
    deleteImageByPath,
    deleteImagesByPath,
    syncSourceToData,
    ensureThumbnail
  };
}
