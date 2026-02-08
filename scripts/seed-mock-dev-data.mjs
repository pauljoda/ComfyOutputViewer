#!/usr/bin/env node

import path from 'node:path';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createDatabase } from '../src/server/db/createDatabase.js';

const MOCK_ROOT = path.resolve(process.env.MOCK_DEV_ROOT || '.mock-dev');
const SOURCE_DIR = path.join(MOCK_ROOT, 'source');
const DATA_DIR = path.join(MOCK_ROOT, 'data');
const INPUTS_DIR = path.join(DATA_DIR, 'inputs');
const DB_PATH = path.join(DATA_DIR, '.comfy_viewer.sqlite');

const MOCK_FOLDER_NAME = 'Mock Examples';

const MOCK_IMAGES = [
  {
    relPath: 'landscapes/mountain-lake.jpg',
    url: 'https://picsum.photos/id/1015/1600/1067.jpg',
    tags: ['landscape', 'nature', 'mountains', 'water'],
    rating: 5,
    favorite: true,
    hidden: false,
    description: 'Wide mountain range with a reflective lake and dramatic clouds.'
  },
  {
    relPath: 'street/night-city.jpg',
    url: 'https://picsum.photos/id/1011/1500/1000.jpg',
    tags: ['street', 'city', 'night', 'lights'],
    rating: 4,
    favorite: true,
    hidden: false,
    description: 'Urban street scene with bokeh lights and evening atmosphere.'
  },
  {
    relPath: 'portraits/studio-subject.jpg',
    url: 'https://picsum.photos/id/1027/1200/1600.jpg',
    tags: ['portrait', 'person', 'studio', 'character'],
    rating: 4,
    favorite: false,
    hidden: false,
    description: 'Portrait-style subject image for face/detail oriented prompts.'
  },
  {
    relPath: 'architecture/minimal-facade.jpg',
    url: 'https://picsum.photos/id/1043/1400/1000.jpg',
    tags: ['architecture', 'minimal', 'geometry', 'lines'],
    rating: 3,
    favorite: false,
    hidden: false,
    description: 'Clean architectural facade with strong geometric composition.'
  },
  {
    relPath: 'nature/forest-path.jpg',
    url: 'https://picsum.photos/id/103/1500/1000.jpg',
    tags: ['nature', 'forest', 'path', 'green'],
    rating: 5,
    favorite: true,
    hidden: false,
    description: 'Tree-lined woodland path useful for environment transformations.'
  },
  {
    relPath: 'abstract/color-grid.jpg',
    url: 'https://picsum.photos/id/1060/1400/1400.jpg',
    tags: ['abstract', 'colorful', 'texture', 'design'],
    rating: 2,
    favorite: false,
    hidden: true,
    description: 'Abstract texture image included to exercise hidden image states.'
  }
];

const MOCK_WORKFLOWS = [
  {
    name: 'Mock Text to Image',
    description: 'Starter text-to-image workflow with editable prompt, seed, and step count.',
    apiJson: {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: 267845113,
          steps: 20,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0]
        }
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: 'sd_xl_base_1.0.safetensors'
        }
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: 1024,
          height: 1024,
          batch_size: 1
        }
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'cinematic landscape, golden hour, volumetric lighting',
          clip: ['4', 1]
        }
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'blurry, distorted, low quality',
          clip: ['4', 1]
        }
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2]
        }
      },
      '9': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'ComfyUI',
          images: ['8', 0]
        }
      }
    },
    inputs: [
      {
        nodeId: '6',
        nodeTitle: 'Positive Prompt',
        inputKey: 'text',
        inputType: 'text',
        label: 'Prompt',
        defaultValue: 'cinematic landscape, golden hour, volumetric lighting'
      },
      {
        nodeId: '7',
        nodeTitle: 'Negative Prompt',
        inputKey: 'text',
        inputType: 'text',
        label: 'Negative Prompt',
        defaultValue: 'blurry, distorted, low quality'
      },
      {
        nodeId: '3',
        nodeTitle: 'Sampler',
        inputKey: 'seed',
        inputType: 'seed',
        label: 'Seed',
        defaultValue: '267845113'
      },
      {
        nodeId: '3',
        nodeTitle: 'Sampler',
        inputKey: 'steps',
        inputType: 'number',
        label: 'Steps',
        defaultValue: '20'
      }
    ]
  },
  {
    name: 'Mock Image Remix',
    description:
      'Example image-to-image style workflow using a gallery image input and prompt controls.',
    apiJson: {
      '1': {
        class_type: 'LoadImage',
        inputs: {
          image: 'nature/forest-path.jpg',
          upload: 'image'
        }
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: 'sd_xl_base_1.0.safetensors'
        }
      },
      '5': {
        class_type: 'VAEEncode',
        inputs: {
          pixels: ['1', 0],
          vae: ['4', 2]
        }
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'lush cinematic forest, soft haze, detailed foliage',
          clip: ['4', 1]
        }
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'low detail, overexposed, artifacts',
          clip: ['4', 1]
        }
      },
      '8': {
        class_type: 'KSampler',
        inputs: {
          seed: 882341220,
          steps: 24,
          cfg: 6.5,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 0.45,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0]
        }
      },
      '9': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['8', 0],
          vae: ['4', 2]
        }
      },
      '10': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'ComfyUI',
          images: ['9', 0]
        }
      }
    },
    inputs: [
      {
        nodeId: '1',
        nodeTitle: 'Load Image',
        inputKey: 'image',
        inputType: 'image',
        label: 'Reference Image',
        defaultValue: 'local:nature/forest-path.jpg'
      },
      {
        nodeId: '6',
        nodeTitle: 'Positive Prompt',
        inputKey: 'text',
        inputType: 'text',
        label: 'Remix Prompt',
        defaultValue: 'lush cinematic forest, soft haze, detailed foliage'
      },
      {
        nodeId: '8',
        nodeTitle: 'Sampler',
        inputKey: 'seed',
        inputType: 'seed',
        label: 'Seed',
        defaultValue: '882341220'
      },
      {
        nodeId: '8',
        nodeTitle: 'Sampler',
        inputKey: 'denoise',
        inputType: 'number',
        label: 'Denoise',
        defaultValue: '0.45'
      }
    ]
  }
];

async function main() {
  await fs.mkdir(SOURCE_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(INPUTS_DIR, { recursive: true });

  console.log(`[mock-seed] root: ${MOCK_ROOT}`);
  console.log('[mock-seed] ensuring sample image files...');
  await ensureMockImages();

  const { db, statements, runTransaction } = createDatabase(DB_PATH);
  try {
    seedMetadataAndPromptData(statements, runTransaction);
    seedWorkflows(statements, runTransaction);
  } finally {
    if (typeof db.close === 'function') {
      db.close();
    }
  }

  console.log(`[mock-seed] source dir: ${SOURCE_DIR}`);
  console.log(`[mock-seed] data dir: ${DATA_DIR}`);
  console.log('[mock-seed] complete');
}

async function ensureMockImages() {
  const now = Date.now();
  for (let index = 0; index < MOCK_IMAGES.length; index += 1) {
    const image = MOCK_IMAGES[index];
    const relPath = normalizeRelPath(image.relPath);
    const sourcePath = path.join(SOURCE_DIR, relPath);
    const dataPath = path.join(DATA_DIR, relPath);

    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.mkdir(path.dirname(dataPath), { recursive: true });

    if (!existsSync(sourcePath)) {
      await downloadImage(image.url, sourcePath);
      console.log(`[mock-seed] downloaded ${relPath}`);
    } else {
      console.log(`[mock-seed] reused ${relPath}`);
    }

    await copyIfDifferent(sourcePath, dataPath);

    const timestamp = new Date(now - (MOCK_IMAGES.length - index) * 3_600_000);
    await fs.utimes(sourcePath, timestamp, timestamp);
    await fs.utimes(dataPath, timestamp, timestamp);
  }
}

function seedMetadataAndPromptData(statements, runTransaction) {
  const now = Date.now();
  runTransaction(() => {
    for (const image of MOCK_IMAGES) {
      const relPath = normalizeRelPath(image.relPath);
      statements.upsertFavorite.run(relPath, image.favorite ? 1 : 0);
      statements.upsertHidden.run(relPath, image.hidden ? 1 : 0);
      statements.upsertRating.run(relPath, normalizeRating(image.rating));
      statements.deleteTagsByPath.run(relPath);
      const tags = normalizeTags(image.tags);
      for (const tag of tags) {
        statements.insertTag.run(relPath, tag);
      }
      const promptData = {
        source: 'mock-dev-seed',
        summary: image.description,
        inputJson: {
          Prompt: image.description,
          Tags: tags.join(', ')
        }
      };
      statements.insertImagePrompt.run(relPath, null, JSON.stringify(promptData), now);
    }
  });
}

function seedWorkflows(statements, runTransaction) {
  const now = Date.now();
  const folderId = ensureMockFolder(statements, now);
  const existingByName = new Map();
  for (const row of statements.selectWorkflows.iterate()) {
    existingByName.set(row.name, row);
  }

  for (let index = 0; index < MOCK_WORKFLOWS.length; index += 1) {
    const definition = MOCK_WORKFLOWS[index];
    const existing = existingByName.get(definition.name);
    let workflowId;

    if (existing) {
      workflowId = existing.id;
      statements.updateWorkflow.run(
        definition.name,
        definition.description || null,
        JSON.stringify(definition.apiJson),
        now,
        workflowId
      );
      statements.updateWorkflowFolderAndOrder.run(folderId, index, now, workflowId);
    } else {
      const result = statements.insertWorkflow.run(
        definition.name,
        definition.description || null,
        JSON.stringify(definition.apiJson),
        folderId,
        index,
        now,
        now
      );
      workflowId = Number(result.lastInsertRowid);
    }

    runTransaction(() => {
      statements.deleteJobInputsByWorkflowId.run(workflowId);
      statements.deleteWorkflowInputs.run(workflowId);
      for (let inputIndex = 0; inputIndex < definition.inputs.length; inputIndex += 1) {
        const input = definition.inputs[inputIndex];
        const label = typeof input.label === 'string' ? input.label.trim() : '';
        statements.insertWorkflowInput.run(
          workflowId,
          input.nodeId,
          input.nodeTitle || null,
          input.inputKey,
          input.inputType,
          label || input.inputKey,
          input.defaultValue ?? null,
          inputIndex
        );
      }
    });
  }
}

function ensureMockFolder(statements, now) {
  let existing = null;
  let maxSortOrder = 0;

  for (const row of statements.selectWorkflowFolders.iterate()) {
    if (row.sort_order > maxSortOrder) {
      maxSortOrder = row.sort_order;
    }
    if (row.name === MOCK_FOLDER_NAME) {
      existing = row;
    }
  }

  if (existing) {
    return existing.id;
  }

  const result = statements.insertWorkflowFolder.run(MOCK_FOLDER_NAME, maxSortOrder + 1, now, now);
  return Number(result.lastInsertRowid);
}

async function downloadImage(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ComfyOutputViewer/mock-dev-seed'
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await fs.writeFile(destinationPath, bytes);
}

async function copyIfDifferent(sourcePath, targetPath) {
  const sourceStats = await fs.stat(sourcePath);
  if (existsSync(targetPath)) {
    const targetStats = await fs.stat(targetPath);
    const sameSize = sourceStats.size === targetStats.size;
    const targetIsNewer = targetStats.mtimeMs >= sourceStats.mtimeMs;
    if (sameSize && targetIsNewer) {
      return;
    }
  }
  await fs.copyFile(sourcePath, targetPath);
}

function normalizeRelPath(relPath) {
  return relPath.replaceAll('\\', '/');
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = new Map();
  for (const value of tags) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!normalized) continue;
    if (!out.has(normalized)) {
      out.set(normalized, normalized);
    }
  }
  return Array.from(out.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}

function normalizeRating(rating) {
  const parsed = Number(rating);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(5, Math.round(parsed)));
}

main().catch((error) => {
  console.error('[mock-seed] failed', error);
  process.exitCode = 1;
});
