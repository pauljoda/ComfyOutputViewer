import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerImageRoutes } from './registerImageRoutes.js';
import { makeGet, makeIterable } from '../test/helpers.js';

function createDeps(overrides = {}) {
  return {
    express,
    DATA_DIR: '/tmp/data',
    SOURCE_DIR: '/tmp/source',
    statements: {
      selectImagePrompt: makeGet(() => null),
      selectJobById: makeGet(() => null),
      selectJobInputs: makeIterable([])
    },
    path: {
      basename: (value) => value.split('/').pop(),
      join: (...parts) => parts.filter(Boolean).join('/'),
      dirname: (value) => value.split('/').slice(0, -1).join('/') || '.'
    },
    fs: {
      rename: vi.fn(),
      stat: vi.fn(),
      writeFile: vi.fn()
    },
    createHash: vi.fn(),
    Transform: class {},
    pipeline: vi.fn(),
    createWriteStream: vi.fn(),
    existsSync: vi.fn(() => false),
    MAX_INPUT_UPLOAD_BYTES: 10 * 1024 * 1024,
    INPUTS_DIR: '/tmp/data/inputs',
    loadMetadata: vi.fn(() => ({ favorites: new Map(), hidden: new Map(), ratings: new Map(), tagsByPath: new Map() })),
    listImages: vi.fn(async () => ({ images: [] })),
    setFavorite: vi.fn(),
    setBulkFavorite: vi.fn(),
    setHidden: vi.fn(),
    setBulkHidden: vi.fn(),
    setRating: vi.fn(),
    normalizeRating: vi.fn((value) => Number(value)),
    setBulkRating: vi.fn(),
    setTagsForPath: vi.fn(),
    normalizeTags: vi.fn((tags) => tags),
    setBulkTags: vi.fn(),
    deleteImageByPath: vi.fn(async () => ({ ok: true, deleted: 1, blacklisted: 1 })),
    deleteImagesByPath: vi.fn(async () => ({ ok: true, deleted: 2, blacklisted: 2 })),
    syncSourceToData: vi.fn(async () => ({ scanned: 1, copied: 1, thumbnails: 1 })),
    buildImageItem: vi.fn(async () => null),
    removeFileIfExists: vi.fn(),
    findExistingInputByHash: vi.fn(async () => null),
    resolveImageExtension: vi.fn(() => ''),
    ...overrides
  };
}

describe('registerImageRoutes', () => {
  it('lists images and returns configured directories', async () => {
    const app = express();
    app.use(express.json());
    const deps = createDeps({
      listImages: vi.fn(async () => ({
        images: [{ id: 'a.png' }]
      }))
    });
    registerImageRoutes(app, deps);

    const response = await request(app).get('/api/images');

    expect(response.status).toBe(200);
    expect(response.body.images).toEqual([{ id: 'a.png' }]);
    expect(response.body.sourceDir).toBe('/tmp/source');
    expect(response.body.dataDir).toBe('/tmp/data');
  });

  it('validates and updates favorite state', async () => {
    const app = express();
    app.use(express.json());
    const deps = createDeps();
    registerImageRoutes(app, deps);

    const missing = await request(app).post('/api/favorite').send({});
    expect(missing.status).toBe(400);

    const ok = await request(app).post('/api/favorite').send({ path: 'a.png', value: true });
    expect(ok.status).toBe(200);
    expect(deps.setFavorite).toHaveBeenCalledWith('a.png', true);
  });

  it('normalizes tags before saving', async () => {
    const app = express();
    app.use(express.json());
    const deps = createDeps({
      normalizeTags: vi.fn(() => ['night', 'portrait'])
    });
    registerImageRoutes(app, deps);

    const response = await request(app).post('/api/tags').send({ path: 'x.png', tags: ['night'] });

    expect(response.status).toBe(200);
    expect(deps.normalizeTags).toHaveBeenCalledWith(['night']);
    expect(deps.setTagsForPath).toHaveBeenCalledWith('x.png', ['night', 'portrait']);
    expect(response.body.tags).toEqual(['night', 'portrait']);
  });

  it('returns prompt metadata for an image', async () => {
    const app = express();
    app.use(express.json());
    const deps = createDeps({
      statements: {
        selectImagePrompt: makeGet(() => ({
          image_path: 'img.png',
          job_id: 5,
          prompt_data: JSON.stringify({ foo: 'bar' }),
          created_at: 123
        })),
        selectJobById: makeGet(() => ({ workflow_id: 77 })),
        selectJobInputs: makeIterable([
          { input_id: 1, value: 'x', label: 'Prompt', input_type: 'text', input_key: 'prompt' }
        ])
      }
    });
    registerImageRoutes(app, deps);

    const response = await request(app).get('/api/images/img.png/prompt');

    expect(response.status).toBe(200);
    expect(response.body.workflowId).toBe(77);
    expect(response.body.jobInputs).toHaveLength(1);
    expect(response.body.promptData.foo).toBe('bar');
  });

  it('returns 404 when single image is missing', async () => {
    const app = express();
    app.use(express.json());
    const deps = createDeps({
      buildImageItem: vi.fn(async () => null)
    });
    registerImageRoutes(app, deps);

    const response = await request(app).get('/api/images/missing.png');
    expect(response.status).toBe(404);
  });

  it('rejects input uploads with unsupported content type', async () => {
    const app = express();
    app.use(express.json());
    const deps = createDeps({
      resolveImageExtension: vi.fn(() => '')
    });
    registerImageRoutes(app, deps);

    const response = await request(app)
      .post('/api/inputs/upload')
      .set('x-file-name', 'test.bin')
      .set('content-type', 'application/octet-stream')
      .send(Buffer.from('abc'));

    expect(response.status).toBe(400);
    expect(response.text).toContain('Unsupported image type');
  });
});
