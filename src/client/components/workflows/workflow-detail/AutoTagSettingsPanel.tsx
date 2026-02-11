import type { WorkflowInput } from '../../../types';

type AutoTagSettingsPanelProps = {
  autoTagEnabled: boolean;
  autoTagInputRefs: Set<string>;
  autoTagMaxWords: number;
  autoTagSaving: boolean;
  autoTagEligibleInputs: WorkflowInput[];
  normalizeAutoTagMaxWords: (value: unknown) => number;
  onToggleAutoTagEnabled: () => void;
  onToggleAutoTagInput: (input: WorkflowInput) => void;
  onAutoTagMaxWordsChange: (value: number) => void;
  onAutoTagMaxWordsBlur: () => void;
};

export default function AutoTagSettingsPanel({
  autoTagEnabled,
  autoTagInputRefs,
  autoTagMaxWords,
  autoTagSaving,
  autoTagEligibleInputs,
  normalizeAutoTagMaxWords,
  onToggleAutoTagEnabled,
  onToggleAutoTagInput,
  onAutoTagMaxWordsChange,
  onAutoTagMaxWordsBlur
}: AutoTagSettingsPanelProps) {
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Auto-Tag On Generate</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Automatically applies tags to each generated image after it is saved, using the
            selected text inputs below.
          </p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Best results require comma-separated prompts (for example: "portrait, cinematic
            lighting, dramatic").
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoTagEnabled}
            onChange={onToggleAutoTagEnabled}
            disabled={autoTagSaving || autoTagEligibleInputs.length === 0}
            className="accent-primary"
          />
          Enabled
        </label>
      </div>
      <label className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Max words per auto-tag</span>
        <input
          type="number"
          min={1}
          max={20}
          step={1}
          value={autoTagMaxWords}
          onChange={(event) =>
            onAutoTagMaxWordsChange(normalizeAutoTagMaxWords(event.target.value))
          }
          onBlur={onAutoTagMaxWordsBlur}
          disabled={autoTagSaving}
          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm"
        />
      </label>

      {autoTagEligibleInputs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No text inputs are configured for this workflow yet.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Use these inputs for auto-tag extraction
          </div>
          <div className="max-h-36 overflow-y-auto rounded-md border border-border/70 bg-background/50 p-2">
            <div className="space-y-2">
              {autoTagEligibleInputs.map((input) => {
                const ref = `${input.nodeId}:${input.inputKey}`;
                const displayLabel = input.label?.trim() || input.inputKey;
                const showSystemLabel = displayLabel !== input.inputKey;
                return (
                  <label key={input.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={autoTagInputRefs.has(ref)}
                      onChange={() => onToggleAutoTagInput(input)}
                      disabled={autoTagSaving}
                      className="accent-primary"
                    />
                    <span className="font-medium">{displayLabel}</span>
                    {showSystemLabel && (
                      <span className="text-muted-foreground">{input.inputKey}</span>
                    )}
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                      {input.inputType}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {autoTagSaving && (
        <p className="text-xs text-muted-foreground">Saving auto-tag settings...</p>
      )}
    </div>
  );
}
