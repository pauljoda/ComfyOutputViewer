import { Code2 } from 'lucide-react';
import { Button } from '../../ui/button';
import ImageInputField from '../ImageInputField';
import type { WorkflowInput } from '../../../types';

type WorkflowInputsSectionProps = {
  inputs: WorkflowInput[];
  inputValues: Record<number, string>;
  showDebug: boolean;
  promptPreview: string;
  running: boolean;
  error: string | null;
  onInputChange: (inputId: number, value: string) => void;
  onOpenInputPreview: (imagePath: string) => void;
  onSetError: (message: string | null) => void;
  onRun: () => void;
  onOpenExportApi: () => void;
};

export default function WorkflowInputsSection({
  inputs,
  inputValues,
  showDebug,
  promptPreview,
  running,
  error,
  onInputChange,
  onOpenInputPreview,
  onSetError,
  onRun,
  onOpenExportApi
}: WorkflowInputsSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold">Inputs</h3>
      {inputs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inputs configured for this workflow.</p>
      ) : (
        <div className="space-y-3">
          {inputs.map((input) => {
            const displayLabel = input.label?.trim() || input.inputKey;
            const showSystemLabel = displayLabel !== input.inputKey;
            return (
              <div key={input.id} className="space-y-1">
                <label htmlFor={`input-${input.id}`} className="block text-sm font-medium">
                  {displayLabel}
                  {showSystemLabel && (
                    <span className="ml-2 text-xs text-muted-foreground">{input.inputKey}</span>
                  )}
                </label>
                {input.inputType === 'text' ? (
                  <textarea
                    id={`input-${input.id}`}
                    value={inputValues[input.id] || ''}
                    onChange={(e) => onInputChange(input.id, e.target.value)}
                    placeholder={`Enter ${displayLabel.toLowerCase()}`}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                ) : input.inputType === 'number' ? (
                  <input
                    id={`input-${input.id}`}
                    type="number"
                    value={inputValues[input.id] || ''}
                    onChange={(e) => onInputChange(input.id, e.target.value)}
                    placeholder={`Enter ${displayLabel.toLowerCase()}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                ) : input.inputType === 'seed' ? (
                  <div className="flex gap-2">
                    <input
                      id={`input-${input.id}`}
                      type="number"
                      value={inputValues[input.id] || ''}
                      onChange={(e) => onInputChange(input.id, e.target.value)}
                      placeholder="Seed value"
                      className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onInputChange(
                          input.id,
                          String(Math.floor(Math.random() * 2147483647))
                        )
                      }
                    >
                      Random
                    </Button>
                  </div>
                ) : input.inputType === 'image' ? (
                  <ImageInputField
                    value={inputValues[input.id] || ''}
                    onChange={(value) => onInputChange(input.id, value)}
                    onPreview={onOpenInputPreview}
                    onError={onSetError}
                  />
                ) : (
                  <input
                    id={`input-${input.id}`}
                    type="text"
                    value={inputValues[input.id] || ''}
                    onChange={(e) => onInputChange(input.id, e.target.value)}
                    placeholder={`Enter ${displayLabel.toLowerCase()}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {showDebug && (
        <div className="rounded-md border p-3">
          <div className="text-xs font-medium text-muted-foreground">Generated prompt JSON (debug=1)</div>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{promptPreview}</pre>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onRun} disabled={running}>
          {running ? 'Running...' : 'Run Workflow'}
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenExportApi}>
          <Code2 className="mr-1 h-3.5 w-3.5" />
          API
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
