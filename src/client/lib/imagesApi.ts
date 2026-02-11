import { apiJson } from './api';
import type { DeleteResponse } from '../types';

export type BulkTagUpdate = { path: string; tags: string[] };

export const setFavorite = (path: string, value: boolean) =>
  apiJson('/api/favorite', { body: { path, value } });

export const setHidden = (path: string, value: boolean) =>
  apiJson('/api/hidden', { body: { path, value } });

export const setRating = (path: string, value: number) =>
  apiJson('/api/rating', { body: { path, value } });

export const setTags = (path: string, tags: string[]) =>
  apiJson('/api/tags', { body: { path, tags } });

export const deleteImage = (path: string) =>
  apiJson<DeleteResponse>('/api/delete', { body: { path } });

export const bulkFavorite = (paths: string[], value: boolean) =>
  apiJson('/api/favorite/bulk', { body: { paths, value } });

export const bulkHidden = (paths: string[], value: boolean) =>
  apiJson('/api/hidden/bulk', { body: { paths, value } });

export const bulkRating = (paths: string[], value: number) =>
  apiJson('/api/rating/bulk', { body: { paths, value } });

export const bulkTags = (updates: BulkTagUpdate[]) =>
  apiJson('/api/tags/bulk', { body: { updates } });

export const bulkDelete = (paths: string[]) =>
  apiJson<DeleteResponse>('/api/delete/bulk', { body: { paths } });

export type BulkPromptEntry = {
  imagePath: string;
  jobId: number | null;
  promptData: {
    inputs?: Array<{ inputId?: number; label?: string; inputType?: string; value: unknown }>;
    workflowInputs?: Array<{ inputId?: number; label?: string; inputType?: string; value: unknown }>;
  };
  jobInputs?: Array<{
    inputId: number;
    value: string;
    label?: string;
    inputType?: string;
    inputKey?: string;
  }>;
  createdAt: number;
};

export type BulkPromptsResponse = {
  prompts: Record<string, BulkPromptEntry>;
};

export const bulkPrompts = (paths: string[]) =>
  apiJson<BulkPromptsResponse>('/api/prompts/bulk', { body: { paths } });
