import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Workflow, WorkflowInput, Job } from '../types';

export default function WorkflowsPage() {
  const { workflowId } = useParams<{ workflowId?: string }>();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

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

  const handleSelectWorkflow = (workflow: Workflow) => {
    navigate(`/workflows/${workflow.id}`);
  };

  const handleBackToList = () => {
    navigate('/workflows');
  };

  return (
    <div className="workflows-page">
      <div className="workflows-layout">
        <aside className="workflows-sidebar">
          <div className="workflows-sidebar-header">
            <h2>Workflows</h2>
            <button
              className="button"
              onClick={() => setShowImportModal(true)}
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
          {!selectedWorkflow ? (
            <div className="workflows-placeholder">
              <h3>Select a workflow</h3>
              <p>Choose a workflow from the sidebar or import a new one to get started.</p>
            </div>
          ) : (
            <WorkflowDetail
              workflow={selectedWorkflow}
              onUpdate={loadWorkflows}
              onBack={handleBackToList}
            />
          )}
        </main>
      </div>

      {showImportModal && (
        <ImportWorkflowModal
          onClose={() => setShowImportModal(false)}
          onImport={() => {
            setShowImportModal(false);
            loadWorkflows();
          }}
        />
      )}
    </div>
  );
}

type WorkflowDetailProps = {
  workflow: Workflow;
  onUpdate: () => void;
  onBack: () => void;
};

function WorkflowDetail({ workflow, onUpdate, onBack }: WorkflowDetailProps) {
  const [inputs, setInputs] = useState<WorkflowInput[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflowDetails();
    loadJobs();
  }, [workflow.id]);

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

  const loadJobs = async () => {
    try {
      const response = await api<{ jobs: Job[] }>(`/api/workflows/${workflow.id}/jobs`);
      setJobs(response.jobs);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

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

  return (
    <div className="workflow-detail">
      <div className="workflow-header">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <h2>{workflow.name}</h2>
      </div>

      {workflow.description && (
        <p className="workflow-description-full">{workflow.description}</p>
      )}

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

        <div className="workflow-actions">
          <button className="button" onClick={handleRun} disabled={running}>
            {running ? 'Running...' : 'Run Workflow'}
          </button>
        </div>

        {error && <p className="workflow-error">{error}</p>}
      </section>

      <section className="workflow-jobs-section">
        <h3>Recent Jobs</h3>
        {jobs.length === 0 ? (
          <p className="jobs-empty">No jobs yet. Run the workflow to generate images.</p>
        ) : (
          <div className="jobs-list">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
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
};

function JobCard({ job }: JobCardProps) {
  const statusClass =
    job.status === 'completed'
      ? 'success'
      : job.status === 'error'
        ? 'error'
        : job.status === 'running'
          ? 'running'
          : 'pending';

  return (
    <div className={`job-card ${statusClass}`}>
      <div className="job-header">
        <span className="job-status">{job.status}</span>
        <span className="job-time">
          {new Date(job.createdAt).toLocaleString()}
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

type ImportWorkflowModalProps = {
  onClose: () => void;
  onImport: () => void;
};

function ImportWorkflowModal({ onClose, onImport }: ImportWorkflowModalProps) {
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setApiJson(json);
        // Parse nodes from the JSON
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
        setNodes(parsedNodes);
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
      await api('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          apiJson,
          inputs: selectedInputs
        })
      });
      onImport();
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

  return (
    <div className="modal import-modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog import-dialog">
        <div className="modal-header">
          <h2>{step === 'upload' ? 'Import Workflow' : 'Configure Inputs'}</h2>
          <button className="tool-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body import-body">
          {error && <p className="import-error">{error}</p>}

          {step === 'upload' && (
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
                <h3>Select Inputs</h3>
                <p className="hint">
                  Click on inputs you want to configure when running the workflow.
                  Text nodes are highlighted - select which type each one is.
                </p>

                <div className="nodes-list">
                  {nodes.map((node) => {
                    const textInputs = Object.entries(node.inputs).filter(
                      ([, value]) => inferInputType(value) !== 'connection'
                    );
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

        <div className="modal-footer">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          {step === 'configure' && (
            <button className="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
