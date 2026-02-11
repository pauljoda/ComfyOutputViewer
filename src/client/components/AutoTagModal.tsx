import { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Plus, Wand2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { ImageItem } from '../types';
import { bulkPrompts, type BulkPromptEntry } from '../lib/imagesApi';
import {
  discoverTextInputs,
  extractTagsFromPrompt,
  type DiscoveredInput,
  type PromptLike
} from '../utils/promptTags';
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

type Step = 'select-inputs' | 'review-tags';

export default function AutoTagModal({
  images,
  availableTags,
  onApply,
  onClose
}: AutoTagModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('select-inputs');

  // Step 1: discovered inputs
  const [prompts, setPrompts] = useState<Record<string, BulkPromptEntry>>({});
  const [discoveredInputs, setDiscoveredInputs] = useState<DiscoveredInput[]>([]);
  const [selectedInputKeys, setSelectedInputKeys] = useState<Set<string>>(new Set());

  // Step 2: tag review
  const [entries, setEntries] = useState<AutoTagEntry[]>([]);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  // Fetch prompt data on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const paths = images.map((img) => img.id);
        const response = await bulkPrompts(paths);
        if (cancelled) return;

        const promptMap = response.prompts;
        setPrompts(promptMap);

        // Discover all text inputs across prompts
        const discovered = discoverTextInputs(promptMap);

        if (discovered.length === 0) {
          setError('No text inputs found in the prompt metadata for the selected images.');
          setLoading(false);
          return;
        }

        setDiscoveredInputs(discovered);

        // Pre-select text-type inputs (not negative) by default
        const preSelected = new Set(
          discovered
            .filter((d) => d.inputType !== 'negative')
            .map((d) => d.key)
        );
        setSelectedInputKeys(preSelected);

        // If there's only one text input, skip straight to review
        if (discovered.length === 1) {
          buildEntries(promptMap, preSelected);
          setStep('review-tags');
        }
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

  const toggleInputKey = (key: string) => {
    setSelectedInputKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const buildEntries = (
    promptMap: Record<string, BulkPromptEntry>,
    keys: Set<string>
  ) => {
    const result: AutoTagEntry[] = [];
    for (const img of images) {
      const prompt = promptMap[img.id] as PromptLike | undefined;
      if (!prompt) continue;
      const parsedTags = extractTagsFromPrompt(prompt, keys);
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
    setEntries(result);
    setTagInputs({});
  };

  const handleProceedToReview = () => {
    if (selectedInputKeys.size === 0) return;
    buildEntries(prompts, selectedInputKeys);
    setStep('review-tags');
  };

  const handleBackToInputs = () => {
    setStep('select-inputs');
  };

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

  const getSuggestions = (imageId: string) => {
    const entry = entries.find((e) => e.image.id === imageId);
    if (!entry) return [];
    const query = normalizeTagInput(tagInputs[imageId] || '');
    return availableTags
      .filter((tag) => !entry.tags.includes(tag) && (!query || tag.includes(query)))
      .slice(0, 20);
  };

  const imagesWithPromptCount = useMemo(
    () => images.filter((img) => img.id in prompts).length,
    [images, prompts]
  );

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
                  : step === 'select-inputs'
                    ? `${imagesWithPromptCount} of ${images.length} image${images.length !== 1 ? 's' : ''} have prompt data`
                    : entries.length > 0
                      ? `${entries.length} image${entries.length !== 1 ? 's' : ''} with tags, ${totalTagChanges} new tag${totalTagChanges !== 1 ? 's' : ''} to add` +
                        (imagesWithPromptCount > entries.length
                          ? ` (${imagesWithPromptCount - entries.length} skipped — no matching tags)`
                          : '')
                      : 'No parseable tags found for the selected inputs'}
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

          {/* Step 1: Select which text inputs to parse */}
          {!loading && !error && step === 'select-inputs' && discoveredInputs.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Select which prompt inputs to extract tags from:
              </div>
              {discoveredInputs.map((input) => (
                <label
                  key={input.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selectedInputKeys.has(input.key)
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/70 bg-muted/20 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedInputKeys.has(input.key)}
                    onChange={() => toggleInputKey(input.key)}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{input.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {input.inputType}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {input.imageCount} image{input.imageCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground" title={input.preview}>
                      {input.preview}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Step 2: Review tags per image */}
          {!loading && step === 'review-tags' && entries.length > 0 && (
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

          {/* Step 2 but no entries matched */}
          {!loading && step === 'review-tags' && entries.length === 0 && !error && (
            <div className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground">
              No parseable tags found from the selected inputs. Try going back and selecting different inputs.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {step === 'review-tags' && discoveredInputs.length > 1 && (
              <Button variant="ghost" size="sm" onClick={handleBackToInputs}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
            )}
          </div>
          {step === 'select-inputs' && (
            <Button
              size="sm"
              onClick={handleProceedToReview}
              disabled={selectedInputKeys.size === 0}
            >
              Next
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
          {step === 'review-tags' && (
            <Button
              size="sm"
              onClick={handleApply}
              disabled={entries.length === 0}
            >
              <Wand2 className="mr-1 h-3.5 w-3.5" />
              Apply Tags ({entries.length} image{entries.length !== 1 ? 's' : ''})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
