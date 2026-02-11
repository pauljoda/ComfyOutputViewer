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

type PromptInput = {
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

type PromptData = {
  promptData: PromptPayload;
  jobInputs?: PromptInput[];
};

/**
 * Extracts tags from prompt metadata by finding text-type inputs
 * (positive prompts) and parsing their comma-separated values.
 */
export function extractTagsFromPrompt(prompt: PromptData): string[] {
  const inputs: PromptInput[] = [];

  if (Array.isArray(prompt.promptData?.inputs) && prompt.promptData.inputs.length > 0) {
    inputs.push(...prompt.promptData.inputs);
  } else if (
    Array.isArray(prompt.promptData?.workflowInputs) &&
    prompt.promptData.workflowInputs.length > 0
  ) {
    inputs.push(...prompt.promptData.workflowInputs);
  } else if (Array.isArray(prompt.jobInputs) && prompt.jobInputs.length > 0) {
    inputs.push(
      ...prompt.jobInputs.map((input) => ({
        inputId: input.inputId,
        label: input.label,
        inputType: input.inputType,
        inputKey: input.inputKey,
        value: input.value
      }))
    );
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const input of inputs) {
    // Only parse text-type inputs (positive prompts), skip negative prompts
    if (input.inputType && input.inputType !== 'text') continue;
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
