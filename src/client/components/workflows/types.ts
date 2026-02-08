export type SystemStatsDevice = {
  name: string;
  type: string;
  index: number;
  vram_total: number;
  vram_free: number;
  torch_vram_total: number;
  torch_vram_free: number;
};

export type SystemStatsResponse = {
  system: {
    os: string;
    python_version: string;
    embedded_python: boolean;
  };
  devices: SystemStatsDevice[];
};

export type WorkflowEditorMode = 'import' | 'edit';

export type WorkflowEditorSaveResult = {
  id?: number;
  mode: WorkflowEditorMode;
};

export type WorkflowPrefillEntry = {
  inputId?: number;
  label?: string;
  systemLabel?: string;
  value: string;
};

export type WorkflowPrefill = {
  workflowId: number;
  entries: WorkflowPrefillEntry[];
  sourceImagePath?: string;
  createdAt?: number;
};

export type ImageUploadValue = {
  filename: string;
  subfolder?: string;
  type?: string;
};
