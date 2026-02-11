import { describe, expect, it } from 'vitest';
import { extractTagsFromPrompt, parsePromptTags } from './promptTags';

describe('parsePromptTags', () => {
  it('filters tags by maxWords using space-separated word counting', () => {
    const tags = parsePromptTags(
      'person talks to person, person_talking,  cinematic lighting',
      { maxWords: 2 }
    );

    expect(tags).toEqual(['person_talking', 'cinematic lighting']);
  });

  it('keeps all cleaned tags when maxWords is not provided', () => {
    const tags = parsePromptTags('person talks to person, person_talking');
    expect(tags).toEqual(['person talks to person', 'person_talking']);
  });

  it('trims leading/trailing non-alphanumeric characters while preserving interior symbols', () => {
    const tags = parsePromptTags('  !!!dr. person?!, ###person_talking###, !!portrait!!  ');
    expect(tags).toEqual(['dr. person', 'person_talking', 'portrait']);
  });
});

describe('extractTagsFromPrompt', () => {
  it('applies maxWords when extracting tags from selected inputs', () => {
    const prompt = {
      promptData: {
        inputs: [
          {
            inputId: 1,
            label: 'Prompt',
            inputType: 'text',
            value: 'portrait, vivid cinematic lighting, person_talking'
          }
        ]
      }
    };
    const selectedKeys = new Set(['Prompt']);

    const tags = extractTagsFromPrompt(prompt, selectedKeys, { maxWords: 2 });

    expect(tags).toEqual(['portrait', 'person_talking']);
  });
});
