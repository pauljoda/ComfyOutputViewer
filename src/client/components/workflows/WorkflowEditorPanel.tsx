import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { Workflow, WorkflowInput } from '../../types';
import type { WorkflowEditorMode, WorkflowEditorSaveResult } from './types';

type NodeDefinition = {
  id: string;
  classType: string;
  inputs: Record<string, unknown>;
};

type SelectedWorkflowInput = {
  nodeId: string;
  inputKey: string;
  inputType: string;
  label: string;
  defaultValue: string;
};

type WorkflowEditorPanelProps = {
  mode: WorkflowEditorMode;
  workflow: Workflow | null;
  onClose: () => void;
  onSaved: (result: WorkflowEditorSaveResult) => void;
};

export default function WorkflowEditorPanel({ mode, workflow, onClose, onSaved }: WorkflowEditorPanelProps) {
  const [step, setStep] = useState<'upload' | 'configure'>('upload');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [apiJson, setApiJson] = useState<Record<string, unknown> | null>(null);
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);
  const [selectedInputs, setSelectedInputs] = useState<SelectedWorkflowInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadInputsRequestIdRef = useRef(0);

  const parseNodes = (json: Record<string, unknown>) => {
    const parsedNodes: NodeDefinition[] = [];
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

  const formatDefaultValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const resolveDefaultValueFromJson = (
    json: Record<string, unknown> | null,
    nodeId: string,
    inputKey: string
  ) => {
    if (!json) return '';
    const node = json[nodeId];
    if (!node || typeof node !== 'object') return '';
    const inputs = (node as { inputs?: Record<string, unknown> }).inputs;
    if (!inputs) return '';
    return formatDefaultValue(inputs[inputKey]);
  };

  useEffect(() => {
    const requestId = loadInputsRequestIdRef.current + 1;
    loadInputsRequestIdRef.current = requestId;
    setError(null);

    if (mode === 'import') {
      setStep('upload');
      setName('');
      setDescription('');
      setApiJson(null);
      setNodes([]);
      setSelectedInputs([]);
      setLoading(false);
      return;
    }

    if (!workflow) {
      setStep('configure');
      setApiJson(null);
      setNodes([]);
      setSelectedInputs([]);
      setLoading(false);
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
        if (loadInputsRequestIdRef.current !== requestId) {
          return;
        }
        setSelectedInputs(
          response.inputs.map((input) => ({
            nodeId: input.nodeId,
            inputKey: input.inputKey,
            inputType: input.inputType,
            label: input.label,
            defaultValue:
              input.defaultValue ??
              resolveDefaultValueFromJson(workflow.apiJson, input.nodeId, input.inputKey)
          }))
        );
      })
      .catch((err) => {
        if (loadInputsRequestIdRef.current !== requestId) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load workflow inputs');
      })
      .finally(() => {
        if (loadInputsRequestIdRef.current !== requestId) {
          return;
        }
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
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleToggleInput = (
    nodeId: string,
    inputKey: string,
    inputType: string,
    defaultValue: string
  ) => {
    setSelectedInputs((prev) => {
      const existing = prev.find((item) => item.nodeId === nodeId && item.inputKey === inputKey);
      if (existing) {
        return prev.filter((item) => item !== existing);
      }
      return [
        ...prev,
        {
          nodeId,
          inputKey,
          inputType,
          label: inputKey,
          defaultValue
        }
      ];
    });
  };

  const handleUpdateInputLabel = (nodeId: string, inputKey: string, label: string) => {
    setSelectedInputs((prev) =>
      prev.map((item) =>
        item.nodeId === nodeId && item.inputKey === inputKey ? { ...item, label } : item
      )
    );
  };

  const handleUpdateInputType = (nodeId: string, inputKey: string, inputType: string) => {
    setSelectedInputs((prev) =>
      prev.map((item) =>
        item.nodeId === nodeId && item.inputKey === inputKey ? { ...item, inputType } : item
      )
    );
  };

  const handleUpdateInputDefault = (nodeId: string, inputKey: string, defaultValue: string) => {
    setSelectedInputs((prev) =>
      prev.map((item) =>
        item.nodeId === nodeId && item.inputKey === inputKey ? { ...item, defaultValue } : item
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
        return;
      }

      if (!workflow) {
        setError('Missing workflow context for edit mode.');
        return;
      }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const inferInputType = (value: unknown): string => {
    if (typeof value === 'number') {
      if (Number.isInteger(value) && value > 1000000) {
        return 'seed';
      }
      return 'number';
    }
    if (typeof value === 'string') {
      return 'text';
    }
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string') {
      return 'connection';
    }
    return 'unknown';
  };

  const sortedNodes = useMemo(() => {
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
                            (item) => item.nodeId === node.id && item.inputKey === key
                          );
                          const selected = selectedInputs.find(
                            (item) => item.nodeId === node.id && item.inputKey === key
                          );
                          const defaultValue = selected?.defaultValue ?? formatDefaultValue(value);

                          return (
                            <div
                              key={key}
                              className={`node-input ${isSelected ? 'selected' : ''} ${inferred === 'text' ? 'text-input' : ''}`}
                            >
                              <button
                                type="button"
                                className="node-input-toggle"
                                onClick={() =>
                                  handleToggleInput(node.id, key, inferred, defaultValue)
                                }
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
                                    placeholder="Custom label (optional)"
                                  />
                                  <input
                                    type={
                                      selected?.inputType === 'number' || selected?.inputType === 'seed'
                                        ? 'number'
                                        : 'text'
                                    }
                                    value={defaultValue}
                                    onChange={(e) =>
                                      handleUpdateInputDefault(node.id, key, e.target.value)
                                    }
                                    placeholder="Default value"
                                    aria-label="Default value"
                                  />
                                  <span className="input-system-label">System label: {key}</span>
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
