import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import type { Workflow, WorkflowInput, Job } from '../types';

export default function WorkflowsPage() {
  const { workflowId } = useParams<{ workflowId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    window.matchMedia('(max-width: 900px)').matches ? false : true
  );
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia('(max-width: 900px)').matches
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const handler = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      setSidebarOpen(event.matches ? false : true);
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api<{ workflows: Workflow[] }>('/api/workflows');
      setWorkflows(response.workflows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  useEffect(() => {
    if (workflowId && workflows.length > 0) {
      const workflow = workflows.find((w) => w.id === Number(workflowId));
      setSelectedWorkflow(workflow || null);
    } else {
      setSelectedWorkflow(null);
    }
  }, [workflowId, workflows]);

  useEffect(() => {
    if (!selectedWorkflow && editMode) {
      setEditMode(false);
      setImportMode(false);
    }
  }, [editMode, selectedWorkflow]);

  const handleSelectWorkflow = (workflow: Workflow) => {
    navigate(`/workflows/${workflow.id}`);
  };

  const handleBackToList = () => {
    navigate('/workflows');
  };

  const handleEditModeChange = (value: boolean) => {
    setEditMode(value);
  };

  const handleOpenImport = () => {
    setImportMode(true);
    setEditMode(false);
  };

  const handleEditorSaved = (result: { id?: number; mode: 'import' | 'edit' }) => {
    loadWorkflows();
    if (result.mode === 'import') {
      setImportMode(false);
      setEditMode(false);
      if (result.id) {
        navigate(`/workflows/${result.id}`);
      }
    }
  };

  const showDebug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('debug') === '1';
  }, [location.search]);

  return (
    <div className="workflows-page">
      <div
        className={`workflows-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${
          isMobile ? 'is-mobile' : ''
        }`}
      >
        <aside className="workflows-sidebar">
          <div className="workflows-sidebar-header">
            <div className="workflows-sidebar-title">
              <button
                className="ghost workflows-toggle"
                type="button"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label={sidebarOpen ? 'Close workflow list' : 'Open workflow list'}
              >
                <span className="hamburger" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
              <h2>Workflows</h2>
            </div>
            <button
              className="button"
              onClick={handleOpenImport}
            >
              + Import
            </button>
          </div>
          <div className="workflows-list">
            {loading && <p className="workflows-loading">Loading...</p>}
            {error && <p className="workflows-error">{error}</p>}
            {!loading && !error && workflows.length === 0 && (
              <p className="workflows-empty">
                No workflows yet. Import a ComfyUI API JSON to get started.
              </p>
            )}
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                className={`workflow-item ${selectedWorkflow?.id === workflow.id ? 'active' : ''}`}
                onClick={() => handleSelectWorkflow(workflow)}
              >
                <span className="workflow-name">{workflow.name}</span>
                {workflow.description && (
                  <span className="workflow-description">{workflow.description}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="workflows-main">
          <div className="workflows-main-header">
            <button
              className="ghost workflows-toggle"
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? 'Close workflow list' : 'Open workflow list'}
            >
              <span className="hamburger" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <span className="workflows-main-title">Workflows</span>
          </div>
          {importMode ? (
            <WorkflowEditorPanel
              mode="import"
              workflow={null}
              onClose={() => setImportMode(false)}
              onSaved={handleEditorSaved}
            />
          ) : !selectedWorkflow ? (
            <div className="workflows-placeholder">
              <h3>Select a workflow</h3>
              <p>Choose a workflow from the sidebar or import a new one to get started.</p>
            </div>
          ) : (
            <WorkflowDetail
              workflow={selectedWorkflow}
              onBack={handleBackToList}
              editMode={editMode}
              onEditModeChange={handleEditModeChange}
              onSaved={handleEditorSaved}
              showDebug={showDebug}
            />
          )}
        </main>
        {isMobile && sidebarOpen && (
          <button
            className="workflows-scrim"
            type="button"
            aria-label="Close workflow list"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

type WorkflowDetailProps = {
  workflow: Workflow;
  onBack: () => void;
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  onSaved: (result: { id?: number; mode: 'import' | 'edit' }) => void;
  showDebug: boolean;
};

function WorkflowDetail({
  workflow,
  onBack,
  editMode,
  onEditModeChange,
  onSaved,
  showDebug
}: WorkflowDetailProps) {
  const [inputs, setInputs] = useState<WorkflowInput[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobClock, setJobClock] = useState(() => Date.now());

  useEffect(() => {
    loadWorkflowDetails();
    loadJobs();
  }, [workflow.id, workflow.updatedAt]);

  const loadWorkflowDetails = async () => {
    try {
      const response = await api<{ workflow: Workflow; inputs: WorkflowInput[] }>(
        `/api/workflows/${workflow.id}`
      );
      setInputs(response.inputs);
      // Initialize input values with defaults
      const defaults: Record<number, string> = {};
      for (const input of response.inputs) {
        defaults[input.id] = input.defaultValue || '';
      }
      setInputValues(defaults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow details');
    }
  };

  const loadJobs = useCallback(async () => {
    try {
      const response = await api<{ jobs: Job[] }>(`/api/workflows/${workflow.id}/jobs`);
      setJobs(response.jobs);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  }, [workflow.id]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'job_update' && message.job) {
          const job = message.job as Job;
          if (job.workflowId !== workflow.id) {
            return;
          }
          setJobs((prev) => {
            const next = prev.filter((item) => item.id !== job.id);
            next.push(job);
            next.sort((a, b) => b.createdAt - a.createdAt);
            return next;
          });
        }
      } catch (err) {
        console.warn('Failed to parse job update:', err);
      }
    };

    return () => {
      socket.close();
    };
  }, [workflow.id]);

  const hasActiveJobs = useMemo(
    () => jobs.some((job) => job.status === 'pending' || job.status === 'queued' || job.status === 'running'),
    [jobs]
  );

  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => {
      setJobClock(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs]);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => {
      loadJobs();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs, loadJobs]);

  const handleInputChange = (inputId: number, value: string) => {
    setInputValues((prev) => ({ ...prev, [inputId]: value }));
  };

  const handleRun = async () => {
    try {
      setRunning(true);
      setError(null);
      const inputData = inputs.map((input) => ({
        inputId: input.id,
        value: inputValues[input.id] || ''
      }));
      await api(`/api/workflows/${workflow.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ inputs: inputData })
      });
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
    } finally {
      setRunning(false);
    }
  };

  const promptPreview = useMemo(() => {
    try {
      const cloned = JSON.parse(JSON.stringify(workflow.apiJson));
      for (const input of inputs) {
        if (Object.prototype.hasOwnProperty.call(inputValues, input.id) && cloned[input.nodeId]) {
          const rawValue = inputValues[input.id];
          cloned[input.nodeId].inputs[input.inputKey] =
            input.inputType === 'number' || input.inputType === 'seed'
              ? Number(rawValue)
              : rawValue;
        }
      }
      return JSON.stringify(cloned, null, 2);
    } catch (err) {
      return `Failed to build prompt JSON: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }, [inputs, inputValues, workflow.apiJson]);

  return (
    <div className="workflow-detail">
      <div className="workflow-header">
        <div className="workflow-header-main">
          <button className="ghost" onClick={onBack}>
            Back
          </button>
          <h2>{workflow.name}</h2>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={editMode}
            onChange={(event) => onEditModeChange(event.target.checked)}
          />
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          <span className="switch-label">Edit Mode</span>
        </label>
      </div>

      {workflow.description && (
        <p className="workflow-description-full">{workflow.description}</p>
      )}

      {editMode ? (
        <section className="workflow-edit-section">
          <WorkflowEditorPanel
            mode="edit"
            workflow={workflow}
            onClose={() => onEditModeChange(false)}
            onSaved={onSaved}
          />
        </section>
      ) : (
        <section className="workflow-inputs-section">
          <h3>Inputs</h3>
          {inputs.length === 0 ? (
            <p className="inputs-empty">No inputs configured for this workflow.</p>
          ) : (
            <div className="workflow-inputs-form">
              {inputs.map((input) => (
                <div key={input.id} className="workflow-input-field">
                  <label htmlFor={`input-${input.id}`}>{input.label}</label>
                  {input.inputType === 'text' ? (
                    <textarea
                      id={`input-${input.id}`}
                      value={inputValues[input.id] || ''}
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                      placeholder={`Enter ${input.label.toLowerCase()}`}
                      rows={3}
                    />
                  ) : input.inputType === 'number' ? (
                    <input
                      id={`input-${input.id}`}
                      type="number"
                      value={inputValues[input.id] || ''}
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                      placeholder={`Enter ${input.label.toLowerCase()}`}
                    />
                  ) : input.inputType === 'seed' ? (
                    <div className="seed-input">
                      <input
                        id={`input-${input.id}`}
                        type="number"
                        value={inputValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder="Seed value"
                      />
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          handleInputChange(
                            input.id,
                            String(Math.floor(Math.random() * 2147483647))
                          )
                        }
                      >
                        Random
                      </button>
                    </div>
                  ) : input.inputType === 'image' ? (
                    <ImageInputField
                      value={inputValues[input.id] || ''}
                      onChange={(value) => handleInputChange(input.id, value)}
                    />
                  ) : (
                    <input
                      id={`input-${input.id}`}
                      type="text"
                      value={inputValues[input.id] || ''}
                      onChange={(e) => handleInputChange(input.id, e.target.value)}
                      placeholder={`Enter ${input.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {showDebug && (
            <div className="workflow-debug">
              <div className="workflow-debug-header">Generated prompt JSON (debug=1)</div>
              <pre className="workflow-debug-json">{promptPreview}</pre>
            </div>
          )}

          <div className="workflow-actions">
            <button className="button primary" onClick={handleRun} disabled={running}>
              {running ? 'Running...' : 'Run Workflow'}
            </button>
          </div>

          {error && <p className="workflow-error">{error}</p>}
        </section>
      )}

      <section className="workflow-jobs-section">
        <h3>Recent Jobs</h3>
        {jobs.length === 0 ? (
          <p className="jobs-empty">No jobs yet. Run the workflow to generate images.</p>
        ) : (
          <div className="jobs-list">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} now={jobClock} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type ImageInputFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function ImageInputField({ value, onChange }: ImageInputFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="image-input-field">
      <div className="image-input-preview">
        {value ? (
          <img src={value.startsWith('/') ? value : `/images/${value}`} alt="Selected" />
        ) : (
          <span className="image-placeholder">No image selected</span>
        )}
      </div>
      <div className="image-input-actions">
        <button type="button" className="ghost" onClick={() => setShowPicker(true)}>
          Select from Gallery
        </button>
        <label className="ghost upload-label">
          Upload New
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // TODO: Handle file upload
                console.log('Upload file:', file);
              }
            }}
          />
        </label>
      </div>
      {showPicker && (
        <ImagePickerModal
          onSelect={(imagePath) => {
            onChange(imagePath);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

type ImagePickerModalProps = {
  onSelect: (imagePath: string) => void;
  onClose: () => void;
};

function ImagePickerModal({ onSelect, onClose }: ImagePickerModalProps) {
  const [images, setImages] = useState<Array<{ id: string; url: string; thumbUrl?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await api<{ images: Array<{ id: string; url: string; thumbUrl?: string; name: string }> }>('/api/images');
      setImages(response.images.slice(0, 100)); // Limit to 100 for performance
    } catch (err) {
      console.error('Failed to load images:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredImages = search
    ? images.filter((img) => img.id.toLowerCase().includes(search.toLowerCase()))
    : images;

  return (
    <div className="modal image-picker-modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog picker-dialog">
        <div className="modal-header">
          <h2>Select Image</h2>
          <button className="tool-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="picker-search">
          <input
            type="text"
            placeholder="Search images..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="picker-grid">
          {loading && <p className="picker-loading">Loading images...</p>}
          {!loading && filteredImages.length === 0 && (
            <p className="picker-empty">No images found</p>
          )}
          {filteredImages.map((img) => (
            <button
              key={img.id}
              className="picker-item"
              onClick={() => onSelect(img.id)}
            >
              <img src={img.thumbUrl || img.url} alt={img.id} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type JobCardProps = {
  job: Job;
  now: number;
};

function JobCard({ job, now }: JobCardProps) {
  const isGenerating = job.status === 'pending' || job.status === 'queued' || job.status === 'running';
  const statusClass =
    job.status === 'completed'
      ? 'success'
      : job.status === 'error'
        ? 'error'
        : job.status === 'queued'
          ? 'queued'
          : job.status === 'running'
            ? 'running'
            : 'pending';
  const statusLabel = isGenerating ? 'Generating Image...' : job.status;
  const startedAt = job.startedAt ?? job.createdAt;
  const endedAt = job.completedAt ?? now;
  const durationMs = Math.max(0, endedAt - startedAt);

  return (
    <div className={`job-card ${statusClass} ${isGenerating ? 'generating' : ''}`}>
      <div className="job-header">
        <span className="job-status">
          {statusLabel}
          {isGenerating && <span className="job-spinner" aria-hidden="true" />}
        </span>
        <span className="job-meta">
          <span className="job-time">
            {new Date(job.createdAt).toLocaleString()}
          </span>
          <span className="job-duration">{formatDuration(durationMs)}</span>
        </span>
      </div>
      {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
      {job.outputs && job.outputs.length > 0 && (
        <div className="job-outputs">
          {job.outputs.map((output, index) => (
            <img
              key={index}
              src={`/images/${output.imagePath}`}
              alt={`Output ${index + 1}`}
              className="job-output-thumb"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type WorkflowEditorPanelProps = {
  mode: 'import' | 'edit';
  workflow: Workflow | null;
  onClose: () => void;
  onSaved: (result: { id?: number; mode: 'import' | 'edit' }) => void;
};

function WorkflowEditorPanel({ mode, workflow, onClose, onSaved }: WorkflowEditorPanelProps) {
  const [step, setStep] = useState<'upload' | 'configure'>('upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [apiJson, setApiJson] = useState<Record<string, unknown> | null>(null);
  const [nodes, setNodes] = useState<Array<{ id: string; classType: string; inputs: Record<string, unknown> }>>([]);
  const [selectedInputs, setSelectedInputs] = useState<Array<{
    nodeId: string;
    inputKey: string;
    inputType: string;
    label: string;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const parseNodes = (json: Record<string, unknown>) => {
    const parsedNodes: Array<{ id: string; classType: string; inputs: Record<string, unknown> }> = [];
    for (const [nodeId, nodeData] of Object.entries(json)) {
      if (typeof nodeData === 'object' && nodeData !== null) {
        const node = nodeData as { class_type?: string; inputs?: Record<string, unknown> };
        if (node.class_type && node.inputs) {
          parsedNodes.push({
            id: nodeId,
            classType: node.class_type,
            inputs: node.inputs
          });
        }
      }
    }
    return parsedNodes;
  };

  useEffect(() => {
    setError(null);
    if (mode === 'import') {
      setStep('upload');
      setName('');
      setDescription('');
      setApiJson(null);
      setNodes([]);
      setSelectedInputs([]);
      return;
    }

    if (!workflow) {
      setStep('configure');
      setApiJson(null);
      setNodes([]);
      setSelectedInputs([]);
      return;
    }

    setStep('configure');
    setName(workflow.name);
    setDescription(workflow.description || '');
    setApiJson(workflow.apiJson);
    setNodes(parseNodes(workflow.apiJson));

    setLoading(true);
    api<{ workflow: Workflow; inputs: WorkflowInput[] }>(`/api/workflows/${workflow.id}`)
      .then((response) => {
        setSelectedInputs(
          response.inputs.map((input) => ({
            nodeId: input.nodeId,
            inputKey: input.inputKey,
            inputType: input.inputType,
            label: input.label
          }))
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load workflow inputs');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [mode, workflow]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setApiJson(json);
        setNodes(parseNodes(json));
        setStep('configure');
        setName(file.name.replace(/\.json$/, ''));
      } catch (err) {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleToggleInput = (nodeId: string, inputKey: string, inputType: string) => {
    setSelectedInputs((prev) => {
      const existing = prev.find((i) => i.nodeId === nodeId && i.inputKey === inputKey);
      if (existing) {
        return prev.filter((i) => i !== existing);
      }
      return [
        ...prev,
        {
          nodeId,
          inputKey,
          inputType,
          label: `${inputKey} (Node ${nodeId})`
        }
      ];
    });
  };

  const handleUpdateInputLabel = (nodeId: string, inputKey: string, label: string) => {
    setSelectedInputs((prev) =>
      prev.map((i) =>
        i.nodeId === nodeId && i.inputKey === inputKey ? { ...i, label } : i
      )
    );
  };

  const handleUpdateInputType = (nodeId: string, inputKey: string, inputType: string) => {
    setSelectedInputs((prev) =>
      prev.map((i) =>
        i.nodeId === nodeId && i.inputKey === inputKey ? { ...i, inputType } : i
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !apiJson) {
      setError('Please provide a name for the workflow');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (mode === 'import') {
        const response = await api<{ ok: boolean; id: number }>('/api/workflows', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            apiJson,
            inputs: selectedInputs
          })
        });
        onSaved({ id: response.id, mode });
      } else if (workflow) {
        await api(`/api/workflows/${workflow.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            apiJson,
            inputs: selectedInputs
          })
        });
        onSaved({ mode });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const inferInputType = (value: unknown): string => {
    if (typeof value === 'number') {
      // Check if it looks like a seed (large integer)
      if (Number.isInteger(value) && value > 1000000) {
        return 'seed';
      }
      return 'number';
    }
    if (typeof value === 'string') {
      return 'text';
    }
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string') {
      // This is a connection reference, not an input
      return 'connection';
    }
    return 'unknown';
  };

  const sortedNodes = React.useMemo(() => {
    if (mode !== 'edit') {
      return nodes;
    }
    const selectedSet = new Set(selectedInputs.map((input) => `${input.nodeId}:${input.inputKey}`));
    return nodes
      .map((node, index) => ({
        node,
        index,
        hasSelected: Object.keys(node.inputs).some((key) => selectedSet.has(`${node.id}:${key}`))
      }))
      .sort((a, b) => {
        if (a.hasSelected === b.hasSelected) {
          return a.index - b.index;
        }
        return a.hasSelected ? -1 : 1;
      })
      .map((entry) => entry.node);
  }, [mode, nodes, selectedInputs]);

  return (
    <div className="workflow-editor-panel">
      <div className="workflow-editor-header">
        <div>
          <h2>{mode === 'import' ? 'Import Workflow' : 'Edit Workflow'}</h2>
          <p className="workflow-editor-subtitle">
            {mode === 'import'
              ? 'Upload a ComfyUI API JSON file and pick which nodes should be configurable.'
              : 'Adjust the inputs and labels, then save your changes.'}
          </p>
        </div>
        <button className="tool-button" onClick={onClose} title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="workflow-editor-body">
        {error && <p className="import-error">{error}</p>}

        {mode === 'import' && step === 'upload' && (
          <div className="upload-section">
            <p>
              Upload a ComfyUI API format JSON file. You can export this from ComfyUI
              by enabling Dev mode and using "Save (API Format)".
            </p>
            <label className="upload-zone">
              <input type="file" accept=".json" onChange={handleFileUpload} />
              <span>Click to select JSON file or drag and drop</span>
            </label>
          </div>
        )}

        {step === 'configure' && (
          <div className="configure-section">
            <div className="workflow-meta">
              <div className="control">
                <label>Workflow Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Workflow"
                />
              </div>
              <div className="control">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this workflow do?"
                />
              </div>
            </div>

            <div className="nodes-section">
              <div className="nodes-header">
                <h3>Select Inputs</h3>
                {loading && <span className="nodes-loading">Refreshing...</span>}
              </div>
              <p className="hint">
                Click on inputs you want to configure when running the workflow.
                Text nodes are highlighted - select which type each one is.
              </p>
              <div className="nodes-legend">
                <span className="legend-item">
                  <span className="legend-chip legend-text" />
                  Text input detected
                </span>
                <span className="legend-item">
                  <span className="legend-chip legend-selected" />
                  Selected input
                </span>
              </div>

              {!apiJson && (
                <p className="nodes-empty">No workflow JSON loaded yet.</p>
              )}

              <div className="nodes-list">
                {sortedNodes.map((node) => {
                  const selectedSet = new Set(
                    selectedInputs.map((input) => `${input.nodeId}:${input.inputKey}`)
                  );
                  const textInputs = Object.entries(node.inputs)
                    .filter(([, value]) => inferInputType(value) !== 'connection')
                    .sort(([keyA], [keyB]) => {
                      if (mode !== 'edit') {
                        return 0;
                      }
                      const selectedA = selectedSet.has(`${node.id}:${keyA}`);
                      const selectedB = selectedSet.has(`${node.id}:${keyB}`);
                      if (selectedA === selectedB) {
                        return 0;
                      }
                      return selectedA ? -1 : 1;
                    });
                  if (textInputs.length === 0) return null;

                  return (
                    <div key={node.id} className="node-card">
                      <div className="node-header">
                        <span className="node-id">Node {node.id}</span>
                        <span className="node-type">{node.classType}</span>
                      </div>
                      <div className="node-inputs">
                        {textInputs.map(([key, value]) => {
                          const inferred = inferInputType(value);
                          const isSelected = selectedInputs.some(
                            (i) => i.nodeId === node.id && i.inputKey === key
                          );
                          const selected = selectedInputs.find(
                            (i) => i.nodeId === node.id && i.inputKey === key
                          );

                          return (
                            <div
                              key={key}
                              className={`node-input ${isSelected ? 'selected' : ''} ${inferred === 'text' ? 'text-input' : ''}`}
                            >
                              <button
                                type="button"
                                className="node-input-toggle"
                                onClick={() => handleToggleInput(node.id, key, inferred)}
                              >
                                <span className="input-key">{key}</span>
                                <span className="input-value">
                                  {typeof value === 'string'
                                    ? value.length > 50
                                      ? value.slice(0, 50) + '...'
                                      : value
                                    : JSON.stringify(value)}
                                </span>
                              </button>

                              {isSelected && (
                                <div className="input-config">
                                  <input
                                    type="text"
                                    value={selected?.label || ''}
                                    onChange={(e) =>
                                      handleUpdateInputLabel(node.id, key, e.target.value)
                                    }
                                    placeholder="Label"
                                  />
                                  <select
                                    value={selected?.inputType || inferred}
                                    onChange={(e) =>
                                      handleUpdateInputType(node.id, key, e.target.value)
                                    }
                                  >
                                    <option value="text">Text (Prompt)</option>
                                    <option value="negative">Text (Negative)</option>
                                    <option value="number">Number</option>
                                    <option value="seed">Seed</option>
                                    <option value="image">Image</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="workflow-editor-footer">
        <button className="ghost" onClick={onClose}>
          Close
        </button>
        {step === 'configure' && (
          <button
            className="button"
            onClick={handleSave}
            disabled={saving || (mode === 'edit' && !workflow)}
          >
            {saving ? 'Saving...' : mode === 'import' ? 'Save Workflow' : 'Update Workflow'}
          </button>
        )}
      </div>
    </div>
  );
}
