import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import WorkflowDetail from './WorkflowDetail';
import WorkflowEditorPanel from './WorkflowEditorPanel';
import type { WorkflowEditorSaveResult, WorkflowPrefill } from './types';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { api } from '../../lib/api';
import type { Workflow, WorkflowFolder } from '../../types';

export default function WorkflowsWorkspace() {
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
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
  const [prefill, setPrefill] = useState<WorkflowPrefill | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [draggedWorkflow, setDraggedWorkflow] = useState<Workflow | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ type: 'folder' | 'root' | 'workflow'; id: number | null } | null>(null);
  const [organizationMode, setOrganizationMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  useEffect(() => {
    setSidebarOpen(isMobile ? false : true);
  }, [isMobile]);

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

  const handleEditorSaved = (result: WorkflowEditorSaveResult) => {
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
