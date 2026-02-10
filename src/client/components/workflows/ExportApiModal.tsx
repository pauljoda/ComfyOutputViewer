import { useEffect, useState, useCallback } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { api } from '../../lib/api';

type TriggerSchemaField = {
  label: string;
  key: string;
  type: string;
  defaultValue: string | null;
  required: boolean;
};

type TriggerSchema = {
  workflowId: number;
  workflowName: string;
  description: string | null;
  endpoint: string;
  method: string;
  contentType: string;
  fields: TriggerSchemaField[];
  example: Record<string, string>;
};

type ExportApiModalProps = {
  workflowId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TABS = ['json', 'curl', 'openwebui'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  json: 'JSON',
  curl: 'curl',
  openwebui: 'Open WebUI MCP',
};

function generateOpenWebUiMcpImportJson(baseUrl: string): string {
  const config = [{
    type: 'mcp',
    url: `${baseUrl}/mcp`,
    spec_type: 'url',
    spec: '',
    path: 'openapi.json',
    auth_type: 'none',
    config: {},
    id: 'comfy-output-viewer-mcp',
    name: 'Comfy Output Viewer MCP',
    description: 'Local Comfy Output Viewer MCP server (list_workflows, run_workflow, get_job_status).',
    info: {
      id: 'comfy-output-viewer-mcp',
      name: 'Comfy Output Viewer MCP',
      description: 'Local Comfy Output Viewer MCP server (list_workflows, run_workflow, get_job_status).'
    }
  }];
  return JSON.stringify(config, null, 2);
}

function generateOpenWebUiSystemPrompt(schema: TriggerSchema): string {
  const fieldHints = schema.fields
    .map((field) => {
      const requiredHint = field.required ? 'required' : 'optional';
      const defaultHint = field.defaultValue !== null ? ` (default: ${field.defaultValue})` : '';
      return `- ${field.label} [${field.type}, ${requiredHint}]${defaultHint}`;
    })
    .join('\n');

  const inputTemplate = schema.fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.label] = field.defaultValue ?? `<${field.type}>`;
    return acc;
  }, {});

  const payloadTemplate = JSON.stringify({
    workflowId: schema.workflowId,
    inputs: inputTemplate
  }, null, 2);

  return `You control Comfy Output Viewer through MCP tools.

Default workflow for this chat:
- Workflow ID: ${schema.workflowId}
- Workflow Name: ${schema.workflowName}

Available input fields for workflow ${schema.workflowId}:
${fieldHints}

When the user asks to generate:
1. Call run_workflow with this JSON shape:
\`\`\`json
${payloadTemplate}
\`\`\`
2. Use exact field labels from the list above.
3. Return only queue confirmation with jobId + appliedInputs unless user asks for status checks.
4. Only call get_job_status when the user explicitly asks to check progress/results.
`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (typeof window !== 'undefined' && window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        markCopied();
        return;
      } catch {
        // Continue with fallback.
      }
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copiedWithExec = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (copiedWithExec) {
        markCopied();
        return;
      }
    } catch {
      // Continue with fallback.
    }
    try {
      window.prompt('Copy to clipboard: Ctrl/Cmd+C, Enter', text);
      markCopied();
    } catch {
      // no-op
    }
  }, [text]);

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function DownloadButton({ filename, text }: { filename: string; text: string }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filename, text]);

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
      <Download className="h-3.5 w-3.5" />
      Download JSON
    </Button>
  );
}

export default function ExportApiModal({ workflowId, open, onOpenChange }: ExportApiModalProps) {
  const [schema, setSchema] = useState<TriggerSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('json');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<TriggerSchema>(`/api/workflows/${workflowId}/trigger-schema`);
        if (!cancelled) setSchema(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load schema');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, workflowId]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8008';

  const jsonPayload = schema ? JSON.stringify(schema.example, null, 2) : '';

  const curlCommand = schema
    ? `curl -X POST ${baseUrl}${schema.endpoint} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(schema.example, null, 2).replace(/'/g, "'\\''")}'`
    : '';

  const openWebUiMcpJson = generateOpenWebUiMcpImportJson(baseUrl);
  const openWebUiSystemPrompt = schema ? generateOpenWebUiSystemPrompt(schema) : '';
  const mcpFilename = `openwebui-mcp-comfy-output-viewer-workflow-${workflowId}.json`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export API</DialogTitle>
          <DialogDescription>
            Use these examples to trigger this workflow from external services.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading schema...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {schema && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Endpoint info */}
            <div className="text-xs space-y-1">
              <div><span className="text-muted-foreground">Endpoint:</span> <code className="bg-muted px-1 rounded">{baseUrl}{schema.endpoint}</code></div>
              <div><span className="text-muted-foreground">Method:</span> <code className="bg-muted px-1 rounded">POST</code></div>
              {schema.fields.length > 0 && (
                <div className="mt-2">
                  <span className="text-muted-foreground">Fields:</span>
                  <div className="mt-1 space-y-0.5">
                    {schema.fields.map((f) => (
                      <div key={f.key} className="flex gap-2 items-baseline">
                        <code className="bg-muted px-1 rounded text-xs">{f.label}</code>
                        <span className="text-muted-foreground text-xs">({f.type})</span>
                        {f.required && <span className="text-destructive text-xs">required</span>}
                        {f.defaultValue !== null && (
                          <span className="text-muted-foreground text-xs">default: {f.defaultValue}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-auto">
              {activeTab === 'json' && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <CopyButton text={jsonPayload} />
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap break-all">
                    {jsonPayload}
                  </pre>
                </div>
              )}

              {activeTab === 'curl' && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <CopyButton text={curlCommand} />
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap break-all">
                    {curlCommand}
                  </pre>
                </div>
              )}

              {activeTab === 'openwebui' && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Import the MCP server JSON in Open WebUI: Workspace &rarr; Tools &rarr; Import.
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">MCP Import JSON</p>
                      <div className="flex gap-2">
                        <CopyButton text={openWebUiMcpJson} />
                        <DownloadButton filename={mcpFilename} text={openWebUiMcpJson} />
                      </div>
                    </div>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-56 whitespace-pre-wrap break-all">
                      {openWebUiMcpJson}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">System Prompt Template (Workflow {schema.workflowId})</p>
                      <CopyButton text={openWebUiSystemPrompt} />
                    </div>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap break-all">
                      {openWebUiSystemPrompt}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
