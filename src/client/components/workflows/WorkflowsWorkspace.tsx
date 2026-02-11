import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Plus,
  GripVertical,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  FolderPlus,
  Check,
  X,
  Pencil,
  Folder,
} from 'lucide-react';
import { Button } from '../ui/button';
import WorkflowDetail from './WorkflowDetail';
import WorkflowEditorPanel from './WorkflowEditorPanel';
import type { WorkflowEditorSaveResult, WorkflowPrefill } from './types';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { api } from '../../lib/api';
import type { Workflow, WorkflowFolder } from '../../types';

const LAST_WORKFLOW_STORAGE_KEY = 'cov_last_workflow_id';

export default function WorkflowsWorkspace() {
  const { workflowId } = useParams<{ workflowId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [folders, setFolders] = useState<WorkflowFolder[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
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
    e.dataTransfer.setData('text/workflow-id', String(workflow.id));
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
    const dragIdFromTransfer = Number(e.dataTransfer.getData('text/workflow-id'));
    const draggedId = Number.isFinite(dragIdFromTransfer) && dragIdFromTransfer > 0
      ? dragIdFromTransfer
      : draggedWorkflow?.id;
    if (!draggedId) return;
    const activeDraggedWorkflow =
      workflows.find((workflow) => workflow.id === draggedId) ?? draggedWorkflow;
    if (!activeDraggedWorkflow) return;

    if (target.type === 'folder' || target.type === 'root') {
      const targetFolderId = target.type === 'root' ? null : target.id;
      if ((activeDraggedWorkflow.folderId ?? null) !== targetFolderId) {
        await handleMoveWorkflow(activeDraggedWorkflow.id, targetFolderId);
      }
    } else if (target.type === 'workflow' && target.id !== null) {
      const targetWorkflow = workflows.find((w) => w.id === target.id);
      if (!targetWorkflow) return;
      const folderId = targetWorkflow.folderId ?? null;
      if ((activeDraggedWorkflow.folderId ?? null) !== folderId) {
        await handleMoveWorkflow(activeDraggedWorkflow.id, folderId);
        setDraggedWorkflow(null);
        return;
      }
      const workflowsInFolder = workflows
        .filter((w) => (w.folderId ?? null) === folderId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const draggedIndex = workflowsInFolder.findIndex((w) => w.id === activeDraggedWorkflow.id);
      const targetIndex = workflowsInFolder.findIndex((w) => w.id === target.id);
      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;
      const newOrder = [...workflowsInFolder];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      await handleReorderWorkflows(newOrder.map((w) => w.id), folderId);
    }
    setDraggedWorkflow(null);
  };

  const handleStepReorder = async (workflow: Workflow, direction: -1 | 1) => {
    const folderId = workflow.folderId ?? null;
    const workflowsInFolder = workflows
      .filter((item) => (item.folderId ?? null) === folderId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIndex = workflowsInFolder.findIndex((item) => item.id === workflow.id);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= workflowsInFolder.length) return;
    const nextOrder = [...workflowsInFolder];
    const [removed] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, removed);
    await handleReorderWorkflows(nextOrder.map((item) => item.id), folderId);
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
      if (workflow) {
        try {
          window.localStorage.setItem(LAST_WORKFLOW_STORAGE_KEY, String(workflow.id));
        } catch (err) {
          console.warn('Failed to persist last workflow selection:', err);
        }
      }
    } else {
      setSelectedWorkflow(null);
    }
  }, [workflowId, workflows]);

  useEffect(() => {
    if (workflowId || workflows.length === 0) return;
    let lastWorkflowId: number | null = null;
    try {
      const storedId = window.localStorage.getItem(LAST_WORKFLOW_STORAGE_KEY);
      const parsedId = Number(storedId);
      if (Number.isFinite(parsedId) && parsedId > 0) {
        lastWorkflowId = parsedId;
      }
    } catch (err) {
      console.warn('Failed to read last workflow selection:', err);
    }
    if (lastWorkflowId === null) return;
    const existing = workflows.find((workflow) => workflow.id === lastWorkflowId);
    if (!existing) {
      try {
        window.localStorage.removeItem(LAST_WORKFLOW_STORAGE_KEY);
      } catch (err) {
        console.warn('Failed to clear stale workflow selection:', err);
      }
      return;
    }
    navigate(`/workflows/${existing.id}`, { replace: true });
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
    try {
      window.localStorage.setItem(LAST_WORKFLOW_STORAGE_KEY, String(workflow.id));
    } catch (err) {
      console.warn('Failed to persist selected workflow:', err);
    }
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
      try {
        if (window.localStorage.getItem(LAST_WORKFLOW_STORAGE_KEY) === String(workflow.id)) {
          window.localStorage.removeItem(LAST_WORKFLOW_STORAGE_KEY);
        }
      } catch (err) {
        console.warn('Failed to clear deleted workflow selection:', err);
      }
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
        try {
          window.localStorage.setItem(LAST_WORKFLOW_STORAGE_KEY, String(result.id));
        } catch (err) {
          console.warn('Failed to persist imported workflow selection:', err);
        }
        navigate(`/workflows/${result.id}`);
      }
    }
  };

  const showDebug = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('debug') === '1';
  }, [location.search]);

  const renderWorkflowItem = (workflow: Workflow) => (
    <button
      key={workflow.id}
      type="button"
      className={`flex w-full items-start gap-1 rounded-lg border-none bg-transparent p-3 text-left font-[inherit] transition-colors hover:bg-accent/50 ${
        selectedWorkflow?.id === workflow.id ? 'bg-accent' : ''
      } ${
        dragOverTarget?.type === 'workflow' && dragOverTarget.id === workflow.id ? 'bg-orange-500/10' : ''
      } ${organizationMode ? 'flex-row items-center' : 'flex-col'}`}
      onClick={() => !organizationMode && handleSelectWorkflow(workflow)}
      draggable={organizationMode && !isMobile}
      onDragStart={(e) => organizationMode && !isMobile && handleDragStart(e, workflow)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => organizationMode && !isMobile && handleDragOver(e, { type: 'workflow', id: workflow.id })}
      onDragLeave={handleDragLeave}
      onDrop={(e) => organizationMode && !isMobile && handleDrop(e, { type: 'workflow', id: workflow.id })}
      style={organizationMode ? { cursor: 'grab' } : undefined}
    >
      {organizationMode && !isMobile && (
        <span className="mr-1 inline-flex shrink-0 items-center justify-center text-muted-foreground" style={{ cursor: 'grab' }}>
          <GripVertical className="size-3" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{workflow.name}</span>
        {workflow.description && (
          <span className="max-w-full truncate text-xs text-muted-foreground">{workflow.description}</span>
        )}
      </div>
      {organizationMode && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(event) => {
              event.stopPropagation();
              void handleStepReorder(workflow, -1);
            }}
            aria-label={`Move ${workflow.name} up`}
            title="Move up"
          >
            <ChevronUp className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(event) => {
              event.stopPropagation();
              void handleStepReorder(workflow, 1);
            }}
            aria-label={`Move ${workflow.name} down`}
            title="Move down"
          >
            <ChevronDown className="size-3" />
          </Button>
        </div>
      )}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 overflow-hidden">
        <aside
          className={`flex shrink-0 flex-col border-r border-border bg-background/70 backdrop-blur-[32px] backdrop-saturate-[180%] transition-[width,opacity,transform,padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            !isMobile && sidebarOpen ? 'w-[min(22rem,28vw)] min-w-[16rem]' : ''
          } ${
            !sidebarOpen && !isMobile ? 'w-0 min-w-0 overflow-hidden border-r-0 opacity-0 p-0 pointer-events-none' : ''
          } ${isMobile ? 'absolute inset-y-0 left-0 z-20 w-[min(78vw,320px)] border-r-0 shadow-2xl' : ''} ${
            isMobile && sidebarOpen ? 'translate-x-0' : ''
          } ${isMobile && !sidebarOpen ? '-translate-x-full' : ''}`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 pb-3">
            <h2 className="m-0 text-base font-bold">Workflows</h2>
            <div className="flex items-center gap-2">
              <Button
                variant={organizationMode ? 'secondary' : 'ghost'}
                size="icon-xs"
                onClick={() => setOrganizationMode(!organizationMode)}
                title="Organize workflows"
                aria-label="Organize workflows"
              >
                <FolderPlus className="size-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenImport}
              >
                <Plus className="size-4" />
                Import
              </Button>
            </div>
          </div>

          {organizationMode && (
            <div className="border-b border-border bg-secondary/5 px-4 py-3">
              <div className="mb-2 flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name…"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 font-[inherit] text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <Button variant="ghost" size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                  Add
                </Button>
              </div>
              <p className="m-0 text-[11px] text-muted-foreground">
                {isMobile
                  ? 'Use up/down controls to reorder. Drag-to-move works on desktop.'
                  : 'Drag workflows to reorder or move to folders. Up/down controls also work.'}
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3">
            {loading && <p className="p-5 text-center text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="p-5 text-center text-sm text-destructive">{error}</p>}
            {!loading && !error && workflows.length === 0 && folders.length === 0 && (
              <p className="p-5 text-center text-sm text-muted-foreground">
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
                  className={`mb-1 rounded-lg transition-colors ${isDragOver ? 'bg-orange-500/10' : ''}`}
                  onDragOver={(e) => organizationMode && !isMobile && handleDragOver(e, { type: 'folder', id: folder.id })}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => organizationMode && !isMobile && handleDrop(e, { type: 'folder', id: folder.id })}
                >
                  <div className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/50">
                    <button
                      type="button"
                      className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground"
                      onClick={() => toggleFolder(folder.id)}
                      aria-label={isExpanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
                    >
                      <ChevronRight
                        className={`size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                    {editingFolder === folder.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1">
                        <input
                          type="text"
                          className="min-w-0 flex-1 rounded-md border border-primary bg-background px-2 py-1 font-[inherit] text-sm font-semibold text-foreground"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameFolder(folder.id);
                            if (e.key === 'Escape') setEditingFolder(null);
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRenameFolder(folder.id)}
                          title="Save"
                          aria-label={`Save ${folder.name}`}
                        >
                          <Check className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setEditingFolder(null)}
                          title="Cancel"
                          aria-label={`Cancel renaming ${folder.name}`}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 truncate border-none bg-transparent p-0 text-left text-[13px] font-semibold text-foreground"
                        onClick={() => toggleFolder(folder.id)}
                        aria-label={`Toggle ${folder.name}`}
                      >
                        <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                        {folder.name}
                        <span className="text-[11px] font-medium text-muted-foreground">({folderWorkflows.length})</span>
                      </button>
                    )}
                    {organizationMode && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingFolder(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          title="Rename folder"
                          aria-label={`Rename ${folder.name}`}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteFolder(folder.id)}
                          title="Delete folder"
                          aria-label={`Delete ${folder.name}`}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="mt-0.5 pl-7">
                      {folderWorkflows.length === 0 ? (
                        <p className="m-0 px-3 py-2 text-xs text-muted-foreground">No workflows</p>
                      ) : (
                        folderWorkflows.map((workflow) => renderWorkflowItem(workflow))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Root level drop zone and workflows */}
            {folders.length > 0 && (
              <div
                className={`min-h-2 rounded-lg transition-[min-height,background-color] ${dragOverTarget?.type === 'root' ? 'min-h-10 bg-orange-500/10' : ''}`}
                onDragOver={(e) => organizationMode && !isMobile && handleDragOver(e, { type: 'root', id: null })}
                onDragLeave={handleDragLeave}
                onDrop={(e) => organizationMode && !isMobile && handleDrop(e, { type: 'root', id: null })}
              >
                {organizationMode && rootWorkflows.length === 0 && (
                  <div className="p-3 text-center text-[11px] text-muted-foreground">Drop here for no folder</div>
                )}
              </div>
            )}

            {/* Root workflows (not in any folder) */}
            {rootWorkflows.map((workflow) => renderWorkflowItem(workflow))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-6 max-[900px]:p-4">
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? 'Close workflow list' : 'Open workflow list'}
            >
              <Menu className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-muted-foreground">Workflows</span>
          </div>
          {importMode ? (
            <WorkflowEditorPanel
              mode="import"
              workflow={null}
              onClose={() => setImportMode(false)}
              onSaved={handleEditorSaved}
            />
          ) : !selectedWorkflow ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <h3 className="mb-2 text-lg font-semibold text-foreground">Select a workflow</h3>
              <p className="m-0 text-sm">Choose a workflow from the sidebar or import a new one to get started.</p>
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
            className="absolute inset-0 z-[15] border-none bg-black/40 backdrop-blur-sm"
            type="button"
            aria-label="Close workflow list"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
