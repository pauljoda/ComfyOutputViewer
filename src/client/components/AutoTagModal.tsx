import { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Plus, Wand2 } from 'lucide-react';
import { Button } from './ui/button';
import type { ImageItem } from '../types';
import { bulkPrompts, type BulkPromptEntry } from '../lib/imagesApi';
import { extractTagsFromPrompt } from '../utils/promptTags';
import { normalizeTagInput } from '../utils/tags';

type AutoTagEntry = {
  image: ImageItem;
  tags: string[];
};

type AutoTagModalProps = {
  images: ImageItem[];
  availableTags: string[];
  onApply: (updates: Array<{ path: string; tags: string[] }>) => void;
  onClose: () => void;
};

export default function AutoTagModal({
  images,
  availableTags,
  onApply,
  onClose
}: AutoTagModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AutoTagEntry[]>([]);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const paths = images.map((img) => img.id);
        const response = await bulkPrompts(paths);
        if (cancelled) return;

        const result: AutoTagEntry[] = [];
        for (const img of images) {
          const prompt = response.prompts[img.id] as BulkPromptEntry | undefined;
          if (!prompt) continue;
          const parsedTags = extractTagsFromPrompt(prompt);
          if (parsedTags.length === 0) continue;
          // Merge existing tags with parsed tags (no duplicates)
          const existingSet = new Set(img.tags);
          const merged = [...img.tags];
          for (const tag of parsedTags) {
            if (!existingSet.has(tag)) {
              existingSet.add(tag);
              merged.push(tag);
            }
          }
          result.push({ image: img, tags: merged });
        }

        if (result.length === 0) {
          setError('No prompt metadata with parseable tags found for the selected images.');
        }
        setEntries(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load prompt data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [images]);

  const handleRemoveTag = (imageId: string, tag: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.image.id === imageId
          ? { ...entry, tags: entry.tags.filter((t) => t !== tag) }
          : entry
      )
    );
  };

  const handleAddTag = (imageId: string) => {
    const raw = tagInputs[imageId] || '';
    const normalized = normalizeTagInput(raw);
    if (!normalized) return;
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.image.id !== imageId) return entry;
        if (entry.tags.includes(normalized)) return entry;
        return { ...entry, tags: [...entry.tags, normalized] };
      })
    );
    setTagInputs((prev) => ({ ...prev, [imageId]: '' }));
  };

  const handleApply = () => {
    const updates = entries.map((entry) => ({
      path: entry.image.id,
      tags: entry.tags
    }));
    onApply(updates);
  };

  const totalTagChanges = useMemo(() => {
    let count = 0;
    for (const entry of entries) {
      const originalSet = new Set(entry.image.tags);
      for (const tag of entry.tags) {
        if (!originalSet.has(tag)) count++;
      }
    }
    return count;
  }, [entries]);

  // Build suggestion lists per image
  const getSuggestions = (imageId: string) => {
    const entry = entries.find((e) => e.image.id === imageId);
    if (!entry) return [];
    const query = normalizeTagInput(tagInputs[imageId] || '');
    return availableTags
      .filter((tag) => !entry.tags.includes(tag) && (!query || tag.includes(query)))
      .slice(0, 20);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border bg-background text-foreground shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Auto-tag from metadata"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Auto-Tag from Metadata</div>
              <div className="text-xs text-muted-foreground">
                {loading
                  ? 'Loading prompt data...'
                  : entries.length > 0
                    ? `${entries.length} image${entries.length !== 1 ? 's' : ''} with metadata found, ${totalTagChanges} new tag${totalTagChanges !== 1 ? 's' : ''} to add`
                    : 'No results'}
              </div>
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Fetching prompt metadata...</span>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-3">
              {entries.map((entry) => {
                const originalSet = new Set(entry.image.tags);
                const suggestions = getSuggestions(entry.image.id);
                return (
                  <div
                    key={entry.image.id}
                    className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"
                  >
                    {/* Thumbnail */}
                    <div className="shrink-0">
                      <img
                        src={entry.image.thumbUrl || entry.image.url}
                        alt={entry.image.name}
                        className="h-20 w-20 rounded-md object-contain bg-black/20"
                      />
                      <div className="mt-1 max-w-[80px] truncate text-[10px] text-muted-foreground" title={entry.image.name}>
                        {entry.image.name}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((tag) => {
                          const isNew = !originalSet.has(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleRemoveTag(entry.image.id, tag)}
                              title="Remove tag"
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs hover:opacity-80 ${
                                isNew
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary text-secondary-foreground'
                              }`}
                            >
                              {tag}
                              <span aria-hidden="true">&times;</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={tagInputs[entry.image.id] || ''}
                          onChange={(e) =>
                            setTagInputs((prev) => ({ ...prev, [entry.image.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag(entry.image.id);
                            }
                          }}
                          placeholder="Add tag..."
                          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleAddTag(entry.image.id)}
                          disabled={!tagInputs[entry.image.id]?.trim()}
                          title="Add tag"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {suggestions.length > 0 && tagInputs[entry.image.id]?.trim() && (
                        <div className="flex flex-wrap gap-1">
                          {suggestions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setEntries((prev) =>
                                  prev.map((e) => {
                                    if (e.image.id !== entry.image.id) return e;
                                    if (e.tags.includes(tag)) return e;
                                    return { ...e, tags: [...e.tags, tag] };
                                  })
                                );
                                setTagInputs((prev) => ({ ...prev, [entry.image.id]: '' }));
                              }}
                              className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-secondary-foreground hover:bg-secondary/80"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={loading || entries.length === 0}
          >
            <Wand2 className="mr-1 h-3.5 w-3.5" />
            Apply Tags ({entries.length} image{entries.length !== 1 ? 's' : ''})
          </Button>
        </div>
      </div>
    </div>
  );
}
