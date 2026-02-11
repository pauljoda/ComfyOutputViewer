import { X } from 'lucide-react';
import { Button } from '../ui/button';
import type { PromptData } from './useImagePromptData';

type ImagePromptOverlayProps = {
  promptData: PromptData | null;
  promptLoading: boolean;
  promptError: string | null;
  promptJson: Record<string, unknown> | null;
  promptWorkflowId: number | null;
  onLoadWorkflow: () => void;
  onClosePrompt: () => void;
};

export default function ImagePromptOverlay({
  promptData,
  promptLoading,
  promptError,
  promptJson,
  promptWorkflowId,
  onLoadWorkflow,
  onClosePrompt
}: ImagePromptOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4"
      onClick={onClosePrompt}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border bg-background text-foreground"
        role="dialog"
        aria-label="Prompt metadata"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <div className="text-sm font-semibold">Generation prompt</div>
            {promptData && (
              <div className="text-xs text-muted-foreground">
                Generated {new Date(promptData.createdAt).toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {promptWorkflowId ? (
              <Button size="sm" onClick={onLoadWorkflow}>
                Load Workflow
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Workflow not saved</span>
            )}
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
              type="button"
              onClick={onClosePrompt}
              aria-label="Close prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {promptLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {promptError && <p className="text-sm text-destructive">{promptError}</p>}
          {promptJson && (
            <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(promptJson, null, 2)}
            </pre>
          )}
          {!promptJson && promptData && (
            <p className="text-sm text-muted-foreground">No input data recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}
