/**
 * Parses comma-separated prompt text into clean tag strings.
 * - Splits on commas
 * - Strips bracket characters: [] () {}
 * - Trims whitespace and collapses internal spaces
 * - Lowercases
 * - Removes empty/duplicate entries
 */
export function parsePromptTags(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const segment of text.split(',')) {
    const cleaned = segment
      .replace(/[[\](){}]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      tags.push(cleaned);
    }
  }
  return tags;
}

export type PromptInput = {
  inputId?: number;
  label?: string;
  inputType?: string;
  inputKey?: string;
  value: unknown;
};

type PromptPayload = {
  workflowInputs?: PromptInput[];
  inputs?: PromptInput[];
};

export type PromptData = {
  promptData: PromptPayload;
  jobInputs?: PromptInput[];
};

/**
 * Resolves the flat list of inputs from prompt metadata,
 * checking promptData.inputs, workflowInputs, then jobInputs.
 */
export function resolvePromptInputs(prompt: PromptData): PromptInput[] {
  if (Array.isArray(prompt.promptData?.inputs) && prompt.promptData.inputs.length > 0) {
    return prompt.promptData.inputs;
  }
  if (
    Array.isArray(prompt.promptData?.workflowInputs) &&
    prompt.promptData.workflowInputs.length > 0
  ) {
    return prompt.promptData.workflowInputs;
  }
  if (Array.isArray(prompt.jobInputs) && prompt.jobInputs.length > 0) {
    return prompt.jobInputs.map((input) => ({
      inputId: input.inputId,
      label: input.label,
      inputType: input.inputType,
      inputKey: input.inputKey,
      value: input.value
    }));
  }
  return [];
}

/** A discovered text input grouped across images. */
export type DiscoveredInput = {
  /** Stable key for grouping (label or inputKey or fallback). */
  key: string;
  /** Display label for the input. */
  label: string;
  /** Input type (text, negative, etc). */
  inputType: string;
  /** Short preview of one sample value. */
  preview: string;
  /** How many images have this input. */
  imageCount: number;
};

/**
 * Discovers all text-like inputs across a set of prompts, grouped by label.
 * Returns a list of distinct inputs the user can choose from.
 */
export function discoverTextInputs(
  prompts: Record<string, PromptData>
): DiscoveredInput[] {
  const groups = new Map<
    string,
    { label: string; inputType: string; preview: string; count: number }
  >();

  for (const prompt of Object.values(prompts)) {
    const inputs = resolvePromptInputs(prompt);
    const seenKeys = new Set<string>();
    for (const input of inputs) {
      // Include text and negative types, plus inputs with no explicit type
      // that have a string value (generic string inputs like "string_a")
      const type = input.inputType || '';
      if (type && type !== 'text' && type !== 'negative') continue;
      const value = input.value;
      if (typeof value !== 'string' || !value.trim()) continue;

      const key = input.label || input.inputKey || `input_${input.inputId ?? 'unknown'}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const existing = groups.get(key);
      if (existing) {
        existing.count++;
      } else {
        const preview =
          value.length > 80 ? value.slice(0, 80).trim() + '...' : value;
        groups.set(key, {
          label: input.label || input.inputKey || key,
          inputType: type || 'text',
          preview,
          count: 1
        });
      }
    }
  }

  return Array.from(groups.entries())
    .map(([key, group]) => ({
      key,
      label: group.label,
      inputType: group.inputType,
      preview: group.preview,
      imageCount: group.count
    }))
    .sort((a, b) => b.imageCount - a.imageCount || a.label.localeCompare(b.label));
}

/**
 * Extracts tags from prompt metadata, limited to inputs whose label/key
 * matches one of the provided selectedKeys.
 */
export function extractTagsFromPrompt(
  prompt: PromptData,
  selectedKeys: Set<string>
): string[] {
  const inputs = resolvePromptInputs(prompt);
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const input of inputs) {
    const key = input.label || input.inputKey || `input_${input.inputId ?? 'unknown'}`;
    if (!selectedKeys.has(key)) continue;
    const value = input.value;
    if (typeof value !== 'string' || !value.trim()) continue;
    for (const tag of parsePromptTags(value)) {
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }
  }

  return tags;
}
