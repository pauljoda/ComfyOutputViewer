export function registerImageRoutes(app, deps) {
  const {
    express,
    DATA_DIR,
    SOURCE_DIR,
    statements,
    path,
    fs,
    createHash,
    Transform,
    pipeline,
    createWriteStream,
    existsSync,
    MAX_INPUT_UPLOAD_BYTES,
    INPUTS_DIR,
    loadMetadata,
    listImages,
    setFavorite,
    setBulkFavorite,
    setHidden,
    setBulkHidden,
    setRating,
    normalizeRating,
    setBulkRating,
    setTagsForPath,
    normalizeTags,
    setBulkTags,
    deleteImageByPath,
    deleteImagesByPath,
    syncSourceToData,
    buildImageItem,
    removeFileIfExists,
    findExistingInputByHash,
    resolveImageExtension
  } = deps;
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

app.post('/api/rating', async (req, res) => {
  try {
    const { path: relPath, value } = req.body || {};
    if (!relPath) return res.status(400).send('Missing path');
    setRating(relPath, normalizeRating(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update rating');
  }
});

app.post('/api/rating/bulk', async (req, res) => {
  try {
    const { paths, value } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).send('Missing paths');
    }
    setBulkRating(paths, normalizeRating(value));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to update ratings');
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

app.get('/api/images/:path(*)/prompt', async (req, res) => {
  try {
    const imagePath = req.params.path;
    const row = statements.selectImagePrompt.get(imagePath);
    if (!row) {
      return res.status(404).send('No prompt data found for this image');
    }
    const promptData = JSON.parse(row.prompt_data);
    const jobRow = row.job_id ? statements.selectJobById.get(row.job_id) : null;
    if (jobRow && !promptData.workflowId) {
      promptData.workflowId = jobRow.workflow_id;
    }
    const jobInputs = [];
    if (row.job_id) {
      for (const inputRow of statements.selectJobInputs.iterate(row.job_id)) {
        jobInputs.push({
          inputId: inputRow.input_id,
          value: inputRow.value,
          label: inputRow.label,
          inputType: inputRow.input_type,
          inputKey: inputRow.input_key
        });
      }
    }
    res.json({
      imagePath: row.image_path,
      jobId: row.job_id,
      workflowId: promptData.workflowId ?? jobRow?.workflow_id ?? null,
      promptData,
      jobInputs,
      createdAt: row.created_at
    });
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to get prompt data');
  }
});

// Get metadata for a single image
app.get('/api/images/:path(*)', async (req, res) => {
  try {
    const imagePath = req.params.path;
    const metadata = loadMetadata();
    const image = await buildImageItem(imagePath, metadata);
    if (!image) {
      return res.status(404).send('Image not found');
    }
    res.json(image);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Failed to get image');
  }
});

// Upload workflow input image to local inputs folder (hash-deduped)
app.post('/api/inputs/upload', async (req, res) => {
  let tempPath;
  try {
    const headerName = req.headers['x-file-name'];
    const queryName = req.query?.filename;
    const rawName =
      typeof headerName === 'string'
        ? headerName
        : Array.isArray(headerName)
          ? headerName[0]
          : typeof queryName === 'string'
            ? queryName
            : '';
    const originalName = rawName ? path.basename(rawName) : '';
    const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : '';
    const ext = resolveImageExtension(originalName, contentType);
    if (!ext) {
      return res.status(400).send('Unsupported image type');
    }
    const contentLength = Number(req.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > MAX_INPUT_UPLOAD_BYTES) {
      return res.status(413).send(
        `Input image exceeds size limit (${Math.round(MAX_INPUT_UPLOAD_BYTES / (1024 * 1024))} MB)`
      );
    }

    const tempName = `.upload-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    tempPath = path.join(INPUTS_DIR, tempName);

    const hash = createHash('sha256');
    let size = 0;
    const hasher = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk);
        size += chunk.length;
        if (size > MAX_INPUT_UPLOAD_BYTES) {
          const error = new Error('Input upload exceeds configured size limit');
          error.code = 'INPUT_TOO_LARGE';
          callback(error);
          return;
        }
        callback(null, chunk);
      }
    });

    await pipeline(req, hasher, createWriteStream(tempPath));

    const digest = hash.digest('hex');
    const existing = await findExistingInputByHash(digest);
    if (existing) {
      await removeFileIfExists(tempPath);
      return res.json({
        ok: true,
        path: `inputs/${existing}`,
        hash: digest,
        reused: true,
        size
      });
    }

    const finalName = `${digest}${ext}`;
    const finalPath = path.join(INPUTS_DIR, finalName);
    if (existsSync(finalPath)) {
      await removeFileIfExists(tempPath);
      return res.json({
        ok: true,
        path: `inputs/${finalName}`,
        hash: digest,
        reused: true,
        size
      });
    }

    await fs.rename(tempPath, finalPath);
    res.json({
      ok: true,
      path: `inputs/${finalName}`,
      hash: digest,
      reused: false,
      size
    });
  } catch (err) {
    if (tempPath) {
      try {
        await removeFileIfExists(tempPath);
      } catch (cleanupErr) {
        console.warn('Failed to clean up temporary input upload:', cleanupErr);
      }
    }
    if (err?.code === 'INPUT_TOO_LARGE') {
      return res.status(413).send(
        `Input image exceeds size limit (${Math.round(MAX_INPUT_UPLOAD_BYTES / (1024 * 1024))} MB)`
      );
    }
    res.status(500).send(err instanceof Error ? err.message : 'Failed to upload input image');
  }
});
}
