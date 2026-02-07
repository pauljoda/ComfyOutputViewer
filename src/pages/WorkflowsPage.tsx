import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ImageModal from '../components/ImageModal';
import { useTags } from '../contexts/TagsContext';
import { api } from '../lib/api';
import type { Workflow, WorkflowInput, WorkflowFolder, Job, JobOutput, ImageItem, ModalTool } from '../types';

type WorkflowPrefillEntry = {
  inputId?: number;
  label?: string;
  systemLabel?: string;
  value: string;
};

type WorkflowPrefill = {
  workflowId: number;
  entries: WorkflowPrefillEntry[];
  sourceImagePath?: string;
  createdAt?: number;
};

type ImageUploadValue = {
  filename: string;
  subfolder?: string;
  type?: string;
};

export default function WorkflowsPage() {
  const { workflowId } = useParams<{ workflowId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [folders, setFolders] = useState<WorkflowFolder[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingWorkflowId, setMissingWorkflowId] = useState<number | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    window.matchMedia('(max-width: 900px)').matches ? false : true
  );
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia('(max-width: 900px)').matches
  );
  const [prefill, setPrefill] = useState<WorkflowPrefill | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [draggedWorkflow, setDraggedWorkflow] = useState<Workflow | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ type: 'folder' | 'root' | 'workflow'; id: number | null } | null>(null);
  const [organizationMode, setOrganizationMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

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
      const [workflowsRes, foldersRes] = await Promise.all([
        api<{ workflows: Workflow[] }>('/api/workflows'),
        api<{ folders: WorkflowFolder[] }>('/api/workflow-folders')
      ]);
      setWorkflows(workflowsRes.workflows);
      setFolders(foldersRes.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const toggleFolder = useCallback((folderId: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api('/api/workflow-folders', {
        method: 'POST',
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      setNewFolderName('');
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleRenameFolder = async (folderId: number) => {
    if (!editingFolderName.trim()) {
      setEditingFolder(null);
      return;
    }
    try {
      await api(`/api/workflow-folders/${folderId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editingFolderName.trim() })
      });
      setEditingFolder(null);
      setEditingFolderName('');
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    const folder = folders.find((f) => f.id === folderId);
    const workflowsInFolder = workflows.filter((w) => w.folderId === folderId);
    const confirmMsg = workflowsInFolder.length > 0
      ? `Delete folder "${folder?.name}"? The ${workflowsInFolder.length} workflow(s) inside will be moved to the root level.`
      : `Delete folder "${folder?.name}"?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api(`/api/workflow-folders/${folderId}`, { method: 'DELETE' });
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  const handleMoveWorkflow = async (workflowId: number, targetFolderId: number | null) => {
    try {
      await api(`/api/workflows/${workflowId}/move`, {
        method: 'POST',
        body: JSON.stringify({ folderId: targetFolderId })
      });
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move workflow');
    }
  };

  const handleReorderWorkflows = async (workflowIds: number[], folderId: number | null) => {
    try {
      await api('/api/workflows/reorder', {
        method: 'POST',
        body: JSON.stringify({ workflowIds, folderId })
      });
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder workflows');
    }
  };

  const handleDragStart = (e: React.DragEvent, workflow: Workflow) => {
    setDraggedWorkflow(workflow);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedWorkflow(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, target: { type: 'folder' | 'root' | 'workflow'; id: number | null }) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(target);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, target: { type: 'folder' | 'root' | 'workflow'; id: number | null }) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!draggedWorkflow) return;

    if (target.type === 'folder' || target.type === 'root') {
      const targetFolderId = target.type === 'root' ? null : target.id;
      if (draggedWorkflow.folderId !== targetFolderId) {
        await handleMoveWorkflow(draggedWorkflow.id, targetFolderId);
      }
    } else if (target.type === 'workflow' && target.id !== null) {
      // Reorder within the same folder
      const targetWorkflow = workflows.find((w) => w.id === target.id);
      if (!targetWorkflow) return;
      const folderId = targetWorkflow.folderId ?? null;
      const workflowsInFolder = workflows
        .filter((w) => (w.folderId ?? null) === folderId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const draggedIndex = workflowsInFolder.findIndex((w) => w.id === draggedWorkflow.id);
      const targetIndex = workflowsInFolder.findIndex((w) => w.id === target.id);
      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
      const newOrder = [...workflowsInFolder];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      await handleReorderWorkflows(newOrder.map((w) => w.id), folderId);
    }
    setDraggedWorkflow(null);
  };

  const rootWorkflows = useMemo(() => {
    return workflows
      .filter((w) => w.folderId === null || w.folderId === undefined)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [workflows]);

  const workflowsByFolder = useMemo(() => {
    const map = new Map<number, Workflow[]>();
    for (const folder of folders) {
      map.set(folder.id, []);
    }
    for (const workflow of workflows) {
      if (workflow.folderId !== null && workflow.folderId !== undefined) {
        const list = map.get(workflow.folderId);
        if (list) {
          list.push(workflow);
        }
      }
    }
    // Sort each folder's workflows
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [workflows, folders]);

  useEffect(() => {
    if (workflowId && workflows.length > 0) {
      const workflow = workflows.find((w) => w.id === Number(workflowId));
      setSelectedWorkflow(workflow || null);
      setMissingWorkflowId(workflow ? null : Number(workflowId));
    } else {
      setSelectedWorkflow(null);
      setMissingWorkflowId(null);
    }
  }, [workflowId, workflows]);

  useEffect(() => {
    if (workflowId || workflows.length === 0) return;
    navigate(`/workflows/${workflows[0].id}`, { replace: true });
  }, [workflowId, workflows, navigate]);

  useEffect(() => {
    if (!selectedWorkflow && editMode) {
      setEditMode(false);
      setImportMode(false);
    }
  }, [editMode, selectedWorkflow]);

  useEffect(() => {
    const state = location.state as { prefill?: WorkflowPrefill } | null;
    if (state?.prefill) {
      setPrefill(state.prefill);
      try {
        window.sessionStorage.removeItem('comfy_prefill');
      } catch (err) {
        console.warn('Failed to clear workflow prefill payload:', err);
      }
      return;
    }
    try {
      const stored = window.sessionStorage.getItem('comfy_prefill');
      if (!stored) return;
      const parsed = JSON.parse(stored) as WorkflowPrefill;
      if (parsed?.workflowId) {
        setPrefill(parsed);
      }
      window.sessionStorage.removeItem('comfy_prefill');
    } catch (err) {
      console.warn('Failed to read workflow prefill payload:', err);
    }
  }, [location.state]);

  const handleSelectWorkflow = (workflow: Workflow) => {
    navigate(`/workflows/${workflow.id}`);
  };

  const handleBackToList = () => {
    navigate('/workflows');
  };

  const handleEditModeChange = (value: boolean) => {
    setEditMode(value);
  };

  const handleDeleteWorkflow = async (workflow: Workflow) => {
    const confirmed = window.confirm(`Delete "${workflow.name}"? This will remove its jobs too.`);
    if (!confirmed) return;
    try {
      await api(`/api/workflows/${workflow.id}`, { method: 'DELETE' });
      if (selectedWorkflow?.id === workflow.id) {
        navigate('/workflows');
        setSelectedWorkflow(null);
      }
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
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
            <h2>Workflows</h2>
            <div className="workflows-sidebar-actions">
              <button
                className={`ghost small ${organizationMode ? 'active' : ''}`}
                onClick={() => setOrganizationMode(!organizationMode)}
                title="Organize workflows"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M3 3h7l2 2h9v14a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
                  <path d="M12 11v6M9 14h6" />
                </svg>
              </button>
              <button
                className="button"
                onClick={handleOpenImport}
              >
                + Import
              </button>
            </div>
          </div>

          {organizationMode && (
            <div className="workflows-organize-panel">
              <div className="folder-create-form">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name..."
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <button className="ghost small" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                  Add
                </button>
              </div>
              <p className="organize-hint">Drag workflows to reorder or move to folders</p>
            </div>
          )}

          <div className="workflows-list">
            {loading && <p className="workflows-loading">Loading...</p>}
            {error && <p className="workflows-error">{error}</p>}
            {!loading && !error && workflows.length === 0 && folders.length === 0 && (
              <p className="workflows-empty">
                No workflows yet. Import a ComfyUI API JSON to get started.
              </p>
            )}

            {/* Folders */}
            {folders.map((folder) => {
              const folderWorkflows = workflowsByFolder.get(folder.id) || [];
              const isExpanded = expandedFolders.has(folder.id);
              const isDragOver = dragOverTarget?.type === 'folder' && dragOverTarget.id === folder.id;

              return (
                <div
                  key={`folder-${folder.id}`}
                  className={`workflow-folder ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => organizationMode && handleDragOver(e, { type: 'folder', id: folder.id })}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => organizationMode && handleDrop(e, { type: 'folder', id: folder.id })}
                >
                  <div className="folder-header">
                    <button
                      className="folder-toggle"
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="14"
                        height="14"
                        className={isExpanded ? 'expanded' : ''}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                    {editingFolder === folder.id ? (
                      <div className="folder-edit-row">
                        <input
                          type="text"
                          className="folder-name-input"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameFolder(folder.id);
                            if (e.key === 'Escape') setEditingFolder(null);
                          }}
                          autoFocus
                        />
                        <button
                          className="ghost small"
                          onClick={() => handleRenameFolder(folder.id)}
                          title="Save"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </button>
                        <button
                          className="ghost small"
                          onClick={() => setEditingFolder(null)}
                          title="Cancel"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <span
                        className="folder-name"
                        onClick={() => toggleFolder(folder.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                          <path d="M3 4a1 1 0 011-1h6l2 2h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
                        </svg>
                        {folder.name}
                        <span className="folder-count">({folderWorkflows.length})</span>
                      </span>
                    )}
                    {organizationMode && (
                      <div className="folder-actions">
                        <button
                          className="ghost small"
                          onClick={() => {
                            setEditingFolder(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          title="Rename folder"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="ghost small danger"
                          onClick={() => handleDeleteFolder(folder.id)}
                          title="Delete folder"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="folder-contents">
                      {folderWorkflows.length === 0 ? (
                        <p className="folder-empty">No workflows</p>
                      ) : (
                        folderWorkflows.map((workflow) => (
                          <button
                            key={workflow.id}
                            className={`workflow-item ${selectedWorkflow?.id === workflow.id ? 'active' : ''} ${
                              dragOverTarget?.type === 'workflow' && dragOverTarget.id === workflow.id ? 'drag-over' : ''
                            } ${organizationMode ? 'organize-mode' : ''}`}
                            onClick={() => !organizationMode && handleSelectWorkflow(workflow)}
                            draggable={organizationMode}
                            onDragStart={(e) => handleDragStart(e, workflow)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => organizationMode && handleDragOver(e, { type: 'workflow', id: workflow.id })}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => organizationMode && handleDrop(e, { type: 'workflow', id: workflow.id })}
                          >
                            {organizationMode && (
                              <span className="drag-handle">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                                  <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
                                </svg>
                              </span>
                            )}
                            <div className="workflow-item-text">
                              <span className="workflow-name">{workflow.name}</span>
                              {workflow.description && (
                                <span className="workflow-description">{workflow.description}</span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Root level drop zone and workflows */}
            {folders.length > 0 && (
              <div
                className={`root-workflows-section ${dragOverTarget?.type === 'root' ? 'drag-over' : ''}`}
                onDragOver={(e) => organizationMode && handleDragOver(e, { type: 'root', id: null })}
                onDragLeave={handleDragLeave}
                onDrop={(e) => organizationMode && handleDrop(e, { type: 'root', id: null })}
              >
                {organizationMode && rootWorkflows.length === 0 && (
                  <div className="root-drop-hint">Drop here for no folder</div>
                )}
              </div>
            )}

            {/* Root workflows (not in any folder) */}
            {rootWorkflows.map((workflow) => (
              <button
                key={workflow.id}
                className={`workflow-item ${selectedWorkflow?.id === workflow.id ? 'active' : ''} ${
                  dragOverTarget?.type === 'workflow' && dragOverTarget.id === workflow.id ? 'drag-over' : ''
                } ${organizationMode ? 'organize-mode' : ''}`}
                onClick={() => !organizationMode && handleSelectWorkflow(workflow)}
                draggable={organizationMode}
                onDragStart={(e) => handleDragStart(e, workflow)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => organizationMode && handleDragOver(e, { type: 'workflow', id: workflow.id })}
                onDragLeave={handleDragLeave}
                onDrop={(e) => organizationMode && handleDrop(e, { type: 'workflow', id: workflow.id })}
              >
                {organizationMode && (
                  <span className="drag-handle">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                      <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
                    </svg>
                  </span>
                )}
                <div className="workflow-item-text">
                  <span className="workflow-name">{workflow.name}</span>
                  {workflow.description && (
                    <span className="workflow-description">{workflow.description}</span>
                  )}
                </div>
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
              <h3>{missingWorkflowId ? 'Workflow not found' : 'Select a workflow'}</h3>
              {missingWorkflowId ? (
                <p className="workflows-error">
                  Workflow #{missingWorkflowId} could not be found. It may have been deleted.
                </p>
              ) : (
                <p>Choose a workflow from the sidebar or import a new one to get started.</p>
              )}
            </div>
          ) : (
            <WorkflowDetail
              workflow={selectedWorkflow}
              onBack={handleBackToList}
              editMode={editMode}
              onEditModeChange={handleEditModeChange}
              onSaved={handleEditorSaved}
              onDelete={handleDeleteWorkflow}
              showDebug={showDebug}
              prefill={prefill}
              onPrefillApplied={() => setPrefill(null)}
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
  onDelete: (workflow: Workflow) => void;
  showDebug: boolean;
  prefill?: WorkflowPrefill | null;
  onPrefillApplied?: () => void;
};

function WorkflowDetail({
  workflow,
  onBack,
  editMode,
  onEditModeChange,
  onSaved,
  onDelete,
  showDebug,
  prefill,
  onPrefillApplied
}: WorkflowDetailProps) {
  const { availableTags, refreshTags } = useTags();
  const [inputs, setInputs] = useState<WorkflowInput[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobClock, setJobClock] = useState(() => Date.now());
  const [wsConnected, setWsConnected] = useState(false);
  const [outputCache, setOutputCache] = useState<Record<string, ImageItem>>({});
  const [outputPaths, setOutputPaths] = useState<string[]>([]);
  const [selectedOutputPath, setSelectedOutputPath] = useState<string | null>(null);
  const [outputTool, setOutputTool] = useState<ModalTool>(null);
  const prefillAppliedRef = useRef<string | null>(null);
  const imageUploadCacheRef = useRef<Map<string, ImageUploadValue>>(new Map());

  const mergeJobUpdate = useCallback((job: Job) => {
    setJobs((prev) => {
      const next = prev.filter((item) => item.id !== job.id);
      next.push(job);
      next.sort((a, b) => b.createdAt - a.createdAt);
      return next;
    });
    // If job completed but has no outputs, schedule a refetch to catch sync timing issues
    if (job.status === 'completed' && (!job.outputs || job.outputs.length === 0)) {
      setTimeout(async () => {
        try {
          const response = await api<{ job: Job }>(`/api/jobs/${job.id}`);
          if (response?.job?.outputs && response.job.outputs.length > 0) {
            setJobs((prev) => {
              const next = prev.filter((item) => item.id !== response.job.id);
              next.push(response.job);
              next.sort((a, b) => b.createdAt - a.createdAt);
              return next;
            });
          }
        } catch (err) {
          console.warn('Failed to refetch job outputs:', err);
        }
      }, 3000);
    }
  }, []);

  useEffect(() => {
    loadWorkflowDetails();
    loadJobs();
  }, [workflow.id, workflow.updatedAt]);

  useEffect(() => {
    if (!prefill || prefill.workflowId !== workflow.id) {
      prefillAppliedRef.current = null;
      return;
    }
    if (inputs.length === 0) return;
    const prefillKey = `${prefill.workflowId}:${prefill.sourceImagePath || ''}:${prefill.createdAt || ''}`;
    if (prefillAppliedRef.current === prefillKey) return;
    setInputValues((prev) => {
      const next = { ...prev };
      let changed = false;
      const entries = prefill.entries || [];
      const byId = new Map<number, WorkflowPrefillEntry>();
      const byLabel = new Map<string, WorkflowPrefillEntry>();
      const bySystemLabel = new Map<string, WorkflowPrefillEntry>();
      entries.forEach((entry) => {
        if (typeof entry.inputId === 'number') {
          byId.set(entry.inputId, entry);
        }
        if (entry.label) {
          byLabel.set(entry.label.trim(), entry);
        }
        if (entry.systemLabel) {
          bySystemLabel.set(entry.systemLabel.trim(), entry);
        }
      });
      for (const input of inputs) {
        const entry =
          byId.get(input.id) ||
          (input.label ? byLabel.get(input.label.trim()) : undefined) ||
          (input.inputKey ? bySystemLabel.get(input.inputKey.trim()) : undefined);
        if (!entry) continue;
        next[input.id] = entry.value ?? '';
        changed = true;
      }
      return changed ? next : prev;
    });
    prefillAppliedRef.current = prefillKey;
    onPrefillApplied?.();
  }, [prefill, inputs, workflow.id, onPrefillApplied]);

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

  const buildFallbackImage = useCallback((imagePath: string): ImageItem => {
    const name = imagePath.split('/').pop() || imagePath;
    return {
      id: imagePath,
      name,
      url: `/images/${encodeURI(imagePath)}`,
      favorite: false,
      hidden: false,
      rating: 0,
      tags: [],
      createdMs: 0,
      mtimeMs: 0,
      size: 0
    };
  }, []);

  const loadOutputImage = useCallback(async (imagePath: string) => {
    if (outputCache[imagePath]) return;
    try {
      const image = await api<ImageItem>(`/api/images/${encodeURIComponent(imagePath)}`);
      // Ensure tags is always an array for consistency
      const normalizedImage = {
        ...image,
        tags: Array.isArray(image.tags) ? image.tags : []
      };
      setOutputCache((prev) => ({ ...prev, [imagePath]: normalizedImage }));
    } catch (err) {
      setOutputCache((prev) => {
        if (prev[imagePath]) return prev;
        return { ...prev, [imagePath]: buildFallbackImage(imagePath) };
      });
    }
  }, [buildFallbackImage, outputCache]);

  const loadOutputImages = useCallback(async (paths: string[]) => {
    await Promise.all(paths.map((path) => loadOutputImage(path)));
  }, [loadOutputImage]);

  const updateOutputCache = useCallback((imagePath: string, updater: (image: ImageItem) => ImageItem) => {
    setOutputCache((prev) => {
      const current = prev[imagePath] ?? buildFallbackImage(imagePath);
      return { ...prev, [imagePath]: updater(current) };
    });
  }, [buildFallbackImage]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    socket.onopen = () => {
      setWsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'job_update' && message.job) {
          const job = message.job as Job;
          if (job.workflowId !== workflow.id) {
            return;
          }
          mergeJobUpdate(job);
        }
      } catch (err) {
        console.warn('Failed to parse job update:', err);
      }
    };

    socket.onerror = () => {
      setWsConnected(false);
    };

    socket.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      setWsConnected(false);
      socket.close();
    };
  }, [mergeJobUpdate, workflow.id]);

  const hasActiveJobs = useMemo(
    () =>
      running ||
      jobs.some((job) => job.status === 'pending' || job.status === 'queued' || job.status === 'running'),
    [jobs, running]
  );

  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => {
      setJobClock(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs]);

  useEffect(() => {
    if (!hasActiveJobs && wsConnected) return;
    const interval = window.setInterval(() => {
      loadJobs();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [hasActiveJobs, loadJobs, wsConnected]);

  useEffect(() => {
    if (selectedOutputPath) {
      setOutputTool(null);
    }
  }, [selectedOutputPath]);

  const handleInputChange = (inputId: number, value: string) => {
    setInputValues((prev) => ({ ...prev, [inputId]: value }));
  };

  const resolveImageInputValue = useCallback(async (rawValue: string) => {
    if (!rawValue) return '';
    if (!rawValue.startsWith('local:')) return rawValue;
    const imagePath = rawValue.slice('local:'.length);
    if (!imagePath) return '';
    const cached = imageUploadCacheRef.current.get(imagePath);
    if (cached) return cached;
    const sourceUrl = `/images/${encodeURI(imagePath)}`;
    const imageResponse = await fetch(sourceUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to load selected image: ${imagePath}`);
    }
    const blob = await imageResponse.blob();
    const filename = imagePath.split('/').pop() || 'input.png';
    const formData = new FormData();
    formData.append('image', new File([blob], filename, { type: blob.type || 'image/png' }));
    const uploadResponse = await fetch('/api/comfy/upload', {
      method: 'POST',
      body: formData
    });
    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(text || 'Failed to upload image to ComfyUI');
    }
    const uploadResult = await uploadResponse.json();
    const uploadName = typeof uploadResult.name === 'string' ? uploadResult.name : '';
    const uploadSubfolder =
      typeof uploadResult.subfolder === 'string' ? uploadResult.subfolder : '';
    const uploadType = typeof uploadResult.type === 'string' ? uploadResult.type : '';
    if (!uploadName) {
      throw new Error('ComfyUI upload did not return a filename.');
    }
    const uploadValue: ImageUploadValue = {
      filename: uploadName,
      subfolder: uploadSubfolder || undefined,
      type: uploadType || undefined
    };
    imageUploadCacheRef.current.set(imagePath, uploadValue);
    return uploadValue;
  }, []);

  const handleRun = async () => {
    try {
      setRunning(true);
      setError(null);
      const inputData = await Promise.all(
        inputs.map(async (input) => {
          const rawValue = inputValues[input.id] || '';
          const value =
            input.inputType === 'image' ? await resolveImageInputValue(rawValue) : rawValue;
          return { inputId: input.id, value };
        })
      );
      const result = await api<{ ok: boolean; jobId: number }>(`/api/workflows/${workflow.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ inputs: inputData })
      });
      if (result?.jobId) {
        try {
          const response = await api<{ job: Job }>(`/api/jobs/${result.jobId}`);
          if (response?.job) {
            mergeJobUpdate(response.job);
          }
        } catch (err) {
          console.warn('Failed to load new job:', err);
        }
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
    } finally {
      setRunning(false);
    }
  };

  const handleOpenOutput = async (job: Job, output: JobOutput) => {
    const visibleOutputs = job.outputs?.filter((item) => item.exists !== false) ?? [];
    const paths = visibleOutputs.map((item) => item.imagePath);
    if (paths.length === 0) {
      return;
    }
    setOutputPaths(paths);
    setSelectedOutputPath(output.imagePath);
    setOutputTool(null);
    await loadOutputImages(paths);
  };

  const selectedOutputIndex = selectedOutputPath ? outputPaths.indexOf(selectedOutputPath) : -1;
  const selectedOutputImage = selectedOutputPath
    ? outputCache[selectedOutputPath] ?? buildFallbackImage(selectedOutputPath)
    : null;

  useEffect(() => {
    if (selectedOutputPath) {
      loadOutputImage(selectedOutputPath);
    }
  }, [selectedOutputPath, loadOutputImage]);

  // Use global availableTags from TagsContext for consistent tag suggestions across the app

  const handleOutputFavorite = async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.favorite;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, favorite: nextValue }));
    try {
      await api('/api/favorite', {
        method: 'POST',
        body: JSON.stringify({ path: selectedOutputImage.id, value: nextValue })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handleOutputHidden = async () => {
    if (!selectedOutputImage) return;
    const nextValue = !selectedOutputImage.hidden;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, hidden: nextValue }));
    try {
      await api('/api/hidden', {
        method: 'POST',
        body: JSON.stringify({ path: selectedOutputImage.id, value: nextValue })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update hidden state');
    }
  };

  const handleOutputRating = async (rating: number) => {
    if (!selectedOutputImage) return;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, rating }));
    try {
      await api('/api/rating', {
        method: 'POST',
        body: JSON.stringify({ path: selectedOutputImage.id, value: rating })
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rating');
    }
  };

  const handleOutputTags = async (tags: string[]) => {
    if (!selectedOutputImage) return;
    updateOutputCache(selectedOutputImage.id, (current) => ({ ...current, tags }));
    try {
      await api('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ path: selectedOutputImage.id, tags })
      });
      // Refresh global tags so new tags appear in suggestions across the app
      refreshTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags');
    }
  };

  const handleOutputDelete = async () => {
    if (!selectedOutputImage) return;
    const confirmed = window.confirm('Remove this image from the library?');
    if (!confirmed) return;
    try {
      await api('/api/delete', {
        method: 'POST',
        body: JSON.stringify({ path: selectedOutputImage.id })
      });
      setJobs((prev) =>
        prev.map((job) => ({
          ...job,
          outputs: job.outputs?.filter((output) => output.imagePath !== selectedOutputImage.id)
        }))
      );
      setOutputCache((prev) => {
        const next = { ...prev };
        delete next[selectedOutputImage.id];
        return next;
      });
      setOutputPaths((prev) => prev.filter((path) => path !== selectedOutputImage.id));
      setSelectedOutputPath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const promptPreview = useMemo(() => {
    try {
      const cloned = JSON.parse(JSON.stringify(workflow.apiJson));
      for (const input of inputs) {
        if (Object.prototype.hasOwnProperty.call(inputValues, input.id) && cloned[input.nodeId]) {
          const rawValue = inputValues[input.id];
          const resolvedValue =
            input.inputType === 'image' && rawValue?.startsWith('local:')
              ? rawValue.slice('local:'.length)
              : rawValue;
          cloned[input.nodeId].inputs[input.inputKey] =
            input.inputType === 'number' || input.inputType === 'seed'
              ? Number(resolvedValue)
              : resolvedValue;
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
          <h2>{workflow.name}</h2>
        </div>
        <div className="workflow-header-actions">
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
          <button
            className="ghost danger"
            type="button"
            onClick={() => onDelete(workflow)}
          >
            Delete
          </button>
        </div>
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
              {inputs.map((input) => {
                const displayLabel = input.label?.trim() || input.inputKey;
                const showSystemLabel = displayLabel !== input.inputKey;
                return (
                  <div key={input.id} className="workflow-input-field">
                    <label htmlFor={`input-${input.id}`}>
                      <span className="workflow-input-label-main">{displayLabel}</span>
                      {showSystemLabel && (
                        <span className="workflow-input-label-sub">{input.inputKey}</span>
                      )}
                    </label>
                    {input.inputType === 'text' ? (
                      <textarea
                        id={`input-${input.id}`}
                        value={inputValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder={`Enter ${displayLabel.toLowerCase()}`}
                        rows={3}
                      />
                    ) : input.inputType === 'number' ? (
                      <input
                        id={`input-${input.id}`}
                        type="number"
                        value={inputValues[input.id] || ''}
                        onChange={(e) => handleInputChange(input.id, e.target.value)}
                        placeholder={`Enter ${displayLabel.toLowerCase()}`}
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
                        placeholder={`Enter ${displayLabel.toLowerCase()}`}
                      />
                    )}
                  </div>
                );
              })}
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
              <JobCard key={job.id} job={job} now={jobClock} onOpenOutput={handleOpenOutput} />
            ))}
          </div>
        )}
      </section>

      {selectedOutputImage && (
        <ImageModal
          image={selectedOutputImage}
          index={Math.max(0, selectedOutputIndex)}
          total={outputPaths.length || 1}
          modalTool={outputTool}
          availableTags={availableTags}
          onUpdateTags={handleOutputTags}
          onToggleTags={() =>
            setOutputTool((current) => (current === 'tags' ? null : 'tags'))
          }
          onToggleRating={() =>
            setOutputTool((current) => (current === 'rating' ? null : 'rating'))
          }
          onTogglePrompt={() =>
            setOutputTool((current) => (current === 'prompt' ? null : 'prompt'))
          }
          onToggleFavorite={handleOutputFavorite}
          onToggleHidden={handleOutputHidden}
          onRate={handleOutputRating}
          onDelete={handleOutputDelete}
          onClose={() => {
            setSelectedOutputPath(null);
            setOutputTool(null);
          }}
          onPrev={() => {
            if (selectedOutputIndex > 0) {
              setSelectedOutputPath(outputPaths[selectedOutputIndex - 1]);
            }
          }}
          onNext={() => {
            if (selectedOutputIndex >= 0 && selectedOutputIndex < outputPaths.length - 1) {
              setSelectedOutputPath(outputPaths[selectedOutputIndex + 1]);
            }
          }}
        />
      )}
    </div>
  );
}

type ImageInputFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

function ImageInputField({ value, onChange }: ImageInputFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const isLocal = value.startsWith('local:');
  const displayValue = isLocal ? value.slice('local:'.length) : value;
  const previewSrc =
    isLocal && displayValue
      ? `/images/${encodeURI(displayValue)}`
      : !isLocal &&
          (displayValue.startsWith('http://') ||
            displayValue.startsWith('https://') ||
            displayValue.startsWith('/'))
        ? displayValue
        : '';

  return (
    <div className="image-input-field">
      <div className="image-input-preview">
        {previewSrc ? (
          <img src={previewSrc} alt="Selected" />
        ) : displayValue ? (
          <span className="image-selected-label">{displayValue}</span>
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
            onChange(`local:${imagePath}`);
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

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await api<{
        images: Array<{ id: string; url: string; thumbUrl?: string; name: string }>;
      }>('/api/images');
      setImages(response.images);
    } catch (err) {
      console.error('Failed to load images:', err);
    } finally {
      setLoading(false);
    }
  };

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
        <div className="picker-grid">
          {loading && <p className="picker-loading">Loading images...</p>}
          {!loading && images.length === 0 && (
            <p className="picker-empty">No images found</p>
          )}
          {images.map((img) => (
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
  onOpenOutput: (job: Job, output: JobOutput) => void;
};

function JobCard({ job, now, onOpenOutput }: JobCardProps) {
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
      {job.outputs && job.outputs.filter((output) => output.exists !== false).length > 0 && (
        <div className="job-outputs">
          {job.outputs
            .filter((output) => output.exists !== false)
            .map((output, index) => (
            <button
              key={index}
              type="button"
              className="job-output-thumb"
              onClick={() => onOpenOutput(job, output)}
              title="Open in viewer"
            >
              <img
                src={output.thumbUrl || `/images/${encodeURI(output.imagePath)}`}
                alt={`Output ${index + 1}`}
              />
            </button>
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
          label: inputKey
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
                                    placeholder="Custom label (optional)"
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
