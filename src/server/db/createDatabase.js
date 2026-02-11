import { DatabaseSync } from 'node:sqlite';

export function createDatabase(dbPath) {
  const database = new DatabaseSync(dbPath);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      path TEXT PRIMARY KEY,
      favorite INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0
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
    CREATE TABLE IF NOT EXISTS workflow_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      api_json TEXT NOT NULL,
      auto_tag_enabled INTEGER NOT NULL DEFAULT 0,
      auto_tag_input_refs TEXT NOT NULL DEFAULT '[]',
      folder_id INTEGER REFERENCES workflow_folders(id) ON DELETE SET NULL,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL,
      node_title TEXT,
      input_key TEXT NOT NULL,
      input_type TEXT NOT NULL,
      label TEXT NOT NULL,
      default_value TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      prompt_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS job_inputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      input_id INTEGER NOT NULL REFERENCES workflow_inputs(id),
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      comfy_filename TEXT,
      created_at INTEGER NOT NULL,
      output_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS image_prompts (
      image_path TEXT PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
      prompt_data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  ensureMetaColumn(database, 'rating', 'INTEGER NOT NULL DEFAULT 0');
  ensureJobOutputColumn(database, 'output_hash', 'TEXT');
  ensureJobOutputUniqueIndex(database);
  ensureWorkflowColumn(
    database,
    'folder_id',
    'INTEGER REFERENCES workflow_folders(id) ON DELETE SET NULL'
  );
  ensureWorkflowColumn(database, 'sort_order', 'INTEGER DEFAULT 0');
  ensureWorkflowColumn(database, 'auto_tag_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureWorkflowColumn(database, "auto_tag_input_refs", "TEXT NOT NULL DEFAULT '[]'");

  const statements = prepareStatements(database);
  const runTransaction = createTransactionRunner(database);
  return { db: database, statements, runTransaction };
}

export function createTransactionRunner(database) {
  return function runTransaction(task) {
    database.exec('BEGIN');
    try {
      const result = task();
      database.exec('COMMIT');
      return result;
    } catch (err) {
      database.exec('ROLLBACK');
      throw err;
    }
  };
}

function ensureMetaColumn(database, columnName, definition) {
  const columns = database.prepare('PRAGMA table_info(meta)').all();
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(`ALTER TABLE meta ADD COLUMN ${columnName} ${definition};`);
}

function ensureJobOutputColumn(database, columnName, definition) {
  const columns = database.prepare('PRAGMA table_info(job_outputs)').all();
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(`ALTER TABLE job_outputs ADD COLUMN ${columnName} ${definition};`);
}

function ensureJobOutputUniqueIndex(database) {
  const hasIndex = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1")
    .get('idx_job_outputs_job_image_path');
  if (hasIndex) return;

  database.exec(`
    DELETE FROM job_outputs
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM job_outputs
      GROUP BY job_id, image_path
    );
  `);
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_job_outputs_job_image_path ON job_outputs (job_id, image_path);'
  );
}

function ensureWorkflowColumn(database, columnName, definition) {
  const columns = database.prepare('PRAGMA table_info(workflows)').all();
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(`ALTER TABLE workflows ADD COLUMN ${columnName} ${definition};`);
}

function prepareStatements(database) {
  return {
    selectMeta: database.prepare('SELECT path, favorite, hidden, rating FROM meta'),
    selectTags: database.prepare('SELECT path, tag FROM tags ORDER BY path, tag'),
    upsertFavorite: database.prepare(
      'INSERT INTO meta (path, favorite) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET favorite = excluded.favorite'
    ),
    upsertHidden: database.prepare(
      'INSERT INTO meta (path, hidden) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET hidden = excluded.hidden'
    ),
    upsertRating: database.prepare(
      'INSERT INTO meta (path, rating) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET rating = excluded.rating'
    ),
    deleteMeta: database.prepare('DELETE FROM meta WHERE path = ?'),
    deleteTagsByPath: database.prepare('DELETE FROM tags WHERE path = ?'),
    insertTag: database.prepare('INSERT OR IGNORE INTO tags (path, tag) VALUES (?, ?)'),
    selectBlacklist: database.prepare('SELECT 1 FROM blacklist WHERE hash = ? LIMIT 1'),
    insertBlacklist: database.prepare(
      'INSERT OR IGNORE INTO blacklist (hash, created_at) VALUES (?, ?)'
    ),
    hasMeta: database.prepare('SELECT 1 FROM meta LIMIT 1'),
    hasTags: database.prepare('SELECT 1 FROM tags LIMIT 1'),
    // Workflow folder statements
    selectWorkflowFolders: database.prepare(
      'SELECT id, name, sort_order, created_at, updated_at FROM workflow_folders ORDER BY sort_order ASC, name ASC'
    ),
    selectWorkflowFolderById: database.prepare(
      'SELECT id, name, sort_order, created_at, updated_at FROM workflow_folders WHERE id = ?'
    ),
    insertWorkflowFolder: database.prepare(
      'INSERT INTO workflow_folders (name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ),
    updateWorkflowFolder: database.prepare(
      'UPDATE workflow_folders SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?'
    ),
    updateWorkflowFolderSortOrder: database.prepare(
      'UPDATE workflow_folders SET sort_order = ?, updated_at = ? WHERE id = ?'
    ),
    deleteWorkflowFolder: database.prepare('DELETE FROM workflow_folders WHERE id = ?'),
    // Workflow statements
    selectWorkflows: database.prepare(
      'SELECT id, name, description, api_json, auto_tag_enabled, auto_tag_input_refs, folder_id, sort_order, created_at, updated_at FROM workflows ORDER BY (folder_id IS NOT NULL), folder_id ASC, sort_order ASC, name ASC'
    ),
    selectWorkflowById: database.prepare(
      'SELECT id, name, description, api_json, auto_tag_enabled, auto_tag_input_refs, folder_id, sort_order, created_at, updated_at FROM workflows WHERE id = ?'
    ),
    selectWorkflowsByFolder: database.prepare(
      'SELECT id, name, description, api_json, auto_tag_enabled, auto_tag_input_refs, folder_id, sort_order, created_at, updated_at FROM workflows WHERE folder_id = ? ORDER BY sort_order ASC, name ASC'
    ),
    selectWorkflowsWithoutFolder: database.prepare(
      'SELECT id, name, description, api_json, auto_tag_enabled, auto_tag_input_refs, folder_id, sort_order, created_at, updated_at FROM workflows WHERE folder_id IS NULL ORDER BY sort_order ASC, name ASC'
    ),
    insertWorkflow: database.prepare(
      'INSERT INTO workflows (name, description, api_json, folder_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ),
    updateWorkflow: database.prepare(
      'UPDATE workflows SET name = ?, description = ?, api_json = ?, updated_at = ? WHERE id = ?'
    ),
    updateWorkflowAutoTag: database.prepare(
      'UPDATE workflows SET auto_tag_enabled = ?, auto_tag_input_refs = ?, updated_at = ? WHERE id = ?'
    ),
    updateWorkflowFolder: database.prepare(
      'UPDATE workflows SET folder_id = ?, updated_at = ? WHERE id = ?'
    ),
    updateWorkflowSortOrder: database.prepare(
      'UPDATE workflows SET sort_order = ?, updated_at = ? WHERE id = ?'
    ),
    updateWorkflowFolderAndOrder: database.prepare(
      'UPDATE workflows SET folder_id = ?, sort_order = ?, updated_at = ? WHERE id = ?'
    ),
    deleteWorkflow: database.prepare('DELETE FROM workflows WHERE id = ?'),
    // Workflow input statements
    selectWorkflowInputs: database.prepare(
      'SELECT id, workflow_id, node_id, node_title, input_key, input_type, label, default_value, sort_order FROM workflow_inputs WHERE workflow_id = ? ORDER BY sort_order'
    ),
    insertWorkflowInput: database.prepare(
      'INSERT INTO workflow_inputs (workflow_id, node_id, node_title, input_key, input_type, label, default_value, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ),
    deleteWorkflowInputs: database.prepare('DELETE FROM workflow_inputs WHERE workflow_id = ?'),
    deleteJobInputsByWorkflowId: database.prepare(
      'DELETE FROM job_inputs WHERE input_id IN (SELECT id FROM workflow_inputs WHERE workflow_id = ?)'
    ),
    // Job statements
    selectJobsByWorkflow: database.prepare(
      'SELECT id, workflow_id, prompt_id, status, error_message, created_at, started_at, completed_at FROM jobs WHERE workflow_id = ? ORDER BY created_at DESC LIMIT 50'
    ),
    selectJobById: database.prepare(
      'SELECT id, workflow_id, prompt_id, status, error_message, created_at, started_at, completed_at FROM jobs WHERE id = ?'
    ),
    selectJobByPromptId: database.prepare(
      'SELECT id, workflow_id, prompt_id, status, error_message, created_at, started_at, completed_at FROM jobs WHERE prompt_id = ?'
    ),
    selectGeneratingJobs: database.prepare("SELECT id FROM jobs WHERE status IN ('pending', 'queued', 'running')"),
    selectGeneratingJobDetails: database.prepare(
      "SELECT id, workflow_id, prompt_id, status, started_at FROM jobs WHERE status IN ('pending', 'queued', 'running')"
    ),
    insertJob: database.prepare(
      'INSERT INTO jobs (workflow_id, prompt_id, status, created_at) VALUES (?, ?, ?, ?)'
    ),
    updateJobStatus: database.prepare(
      'UPDATE jobs SET status = ?, error_message = ?, started_at = COALESCE(?, started_at), completed_at = ? WHERE id = ?'
    ),
    updateJobPromptId: database.prepare('UPDATE jobs SET prompt_id = ? WHERE id = ?'),
    // Job input statements
    selectJobInputs: database.prepare(
      'SELECT ji.id, ji.job_id, ji.input_id, ji.value, wi.label, wi.input_type, wi.input_key FROM job_inputs ji JOIN workflow_inputs wi ON ji.input_id = wi.id WHERE ji.job_id = ?'
    ),
    insertJobInput: database.prepare('INSERT INTO job_inputs (job_id, input_id, value) VALUES (?, ?, ?)'),
    // Job output statements
    selectJobOutputs: database.prepare(
      'SELECT id, job_id, image_path, comfy_filename, created_at, output_hash FROM job_outputs WHERE job_id = ?'
    ),
    insertJobOutput: database.prepare(
      'INSERT OR IGNORE INTO job_outputs (job_id, image_path, comfy_filename, created_at, output_hash) VALUES (?, ?, ?, ?, ?)'
    ),
    // Image prompt statements
    selectImagePrompt: database.prepare(
      'SELECT image_path, job_id, prompt_data, created_at FROM image_prompts WHERE image_path = ?'
    ),
    insertImagePrompt: database.prepare(
      'INSERT OR REPLACE INTO image_prompts (image_path, job_id, prompt_data, created_at) VALUES (?, ?, ?, ?)'
    )
  };
}
