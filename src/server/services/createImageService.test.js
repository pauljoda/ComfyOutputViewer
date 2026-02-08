import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImageService } from './createImageService.js';
import { makeRun } from '../test/helpers.js';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7YxYQAAAAASUVORK5CYII=',
  'base64'
);

async function createTempDir(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeImage(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, PNG_1X1);
}

describe('createImageService', () => {
  const tempRoots = [];

  afterEach(async () => {
    await Promise.all(
      tempRoots.map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
    tempRoots.length = 0;
  });

  async function makeService({ isHashBlacklisted = () => false } = {}) {
    const root = await createTempDir('cov-image-service-');
    tempRoots.push(root);
    const sourceDir = path.join(root, 'source');
    const dataDir = path.join(root, 'data');
    const thumbDir = path.join(dataDir, '.thumbs');
    const inputsDir = path.join(dataDir, 'inputs');
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(thumbDir, { recursive: true });
    await fs.mkdir(inputsDir, { recursive: true });

    const addHashToBlacklist = vi.fn();
    const statements = {
      deleteTagsByPath: makeRun(),
      deleteMeta: makeRun()
    };

    const service = createImageService({
      path,
      fs,
      createHash,
      createReadStream,
      existsSync,
      imageExtensions: new Set(['.png', '.jpg', '.jpeg', '.webp']),
      dataDir,
      sourceDir,
      thumbDir,
      inputsDir,
      thumbMax: 128,
      thumbQuality: 75,
      statements,
      addHashToBlacklist,
      isHashBlacklisted
    });

    return { root, sourceDir, dataDir, thumbDir, inputsDir, statements, addHashToBlacklist, service };
  }

  it('resolves image extensions from filename and content type', async () => {
    const { service } = await makeService();
    expect(service.resolveImageExtension('test.JPG', '')).toBe('.jpg');
    expect(service.resolveImageExtension('test.bin', 'image/png')).toBe('.png');
    expect(service.resolveImageExtension('test.bin', 'application/octet-stream')).toBe('');
  });

  it('finds existing input files by hash prefix', async () => {
    const { service, inputsDir } = await makeService();
    await writeImage(path.join(inputsDir, 'abc123.png'));
    await writeImage(path.join(inputsDir, 'def456.jpg'));

    await expect(service.findExistingInputByHash('abc123')).resolves.toBe('abc123.png');
    await expect(service.findExistingInputByHash('missing')).resolves.toBeNull();
  });

  it('lists images with metadata and thumbnail urls', async () => {
    const { service, dataDir, thumbDir } = await makeService();
    await writeImage(path.join(dataDir, 'nested', 'photo.png'));
    await writeImage(path.join(thumbDir, 'nested', 'photo.png.jpg'));

    const metadata = {
      favorites: new Map([['nested/photo.png', true]]),
      hidden: new Map([['nested/photo.png', true]]),
      ratings: new Map([['nested/photo.png', 5]]),
      tagsByPath: new Map([['nested/photo.png', ['portrait']]])
    };
    const result = await service.listImages(dataDir, metadata);

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      id: 'nested/photo.png',
      favorite: true,
      hidden: true,
      rating: 5,
      tags: ['portrait']
    });
    expect(result.images[0].thumbUrl).toBe('/images/.thumbs/nested/photo.png.jpg');
  });

  it('deletes image + thumbnail and blacklists hash', async () => {
    const { service, dataDir, thumbDir, statements, addHashToBlacklist } = await makeService();
    const relPath = 'x/sample.png';
    await writeImage(path.join(dataDir, relPath));
    await writeImage(path.join(thumbDir, `${relPath}.jpg`));

    const result = await service.deleteImageByPath(relPath);

    expect(result).toEqual({ ok: true, deleted: 1, blacklisted: 1 });
    expect(existsSync(path.join(dataDir, relPath))).toBe(false);
    expect(existsSync(path.join(thumbDir, `${relPath}.jpg`))).toBe(false);
    expect(addHashToBlacklist).toHaveBeenCalledTimes(1);
    expect(statements.deleteTagsByPath.run).toHaveBeenCalledWith(relPath);
    expect(statements.deleteMeta.run).toHaveBeenCalledWith(relPath);
  });

  it('syncs source images into data and skips blacklisted files', async () => {
    const allowAll = await makeService();
    await writeImage(path.join(allowAll.sourceDir, 'copied.png'));
    const result = await allowAll.service.syncSourceToData();
    expect(result.scanned).toBe(1);
    expect(result.copied).toBe(1);
    expect(existsSync(path.join(allowAll.dataDir, 'copied.png'))).toBe(true);

    const denyAll = await makeService({ isHashBlacklisted: () => true });
    await writeImage(path.join(denyAll.sourceDir, 'blocked.png'));
    const skipped = await denyAll.service.syncSourceToData();
    expect(skipped.scanned).toBe(1);
    expect(skipped.copied).toBe(0);
    expect(existsSync(path.join(denyAll.dataDir, 'blocked.png'))).toBe(false);
  });
});
