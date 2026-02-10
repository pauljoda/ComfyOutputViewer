import { useEffect, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
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
  openwebui: 'Open WebUI Tool',
};

function toSnakeCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function generateOpenWebUiTool(schema: TriggerSchema, baseUrl: string): string {
  const snakeName = toSnakeCase(schema.workflowName);
  const fields = schema.fields;

  const paramDefs = fields
    .map((f) => {
      const name = toSnakeCase(f.label);
      const defaultVal = f.defaultValue !== null ? f.defaultValue : '';
      return `        ${name}: str = "${defaultVal}",`;
    })
    .join('\n');

  const payloadEntries = fields
    .map((f) => {
      const name = toSnakeCase(f.label);
      return `            "${f.label}": ${name},`;
    })
    .join('\n');

  const fieldDescs = fields
    .map((f) => {
      const req = f.required ? ' (required)' : '';
      const def = f.defaultValue !== null ? ` [default: ${f.defaultValue}]` : '';
      return `        :param ${toSnakeCase(f.label)}: ${f.label} (${f.type})${req}${def}`;
    })
    .join('\n');

  return `"""
ComfyUI Workflow: ${schema.workflowName}
Auto-generated Open WebUI Tool for triggering workflow #${schema.workflowId}
"""

import time
import requests
from pydantic import BaseModel, Field


class Tools:
    class Valves(BaseModel):
        comfy_viewer_url: str = Field(
            default="${baseUrl}",
            description="Base URL of the Comfy Output Viewer server"
        )

    def __init__(self):
        self.valves = self.Valves()

    def run_${snakeName}(
        self,
${paramDefs}
    ) -> str:
        """
        Run the ${schema.workflowName} ComfyUI workflow.
${fieldDescs}
        """
        url = f"{self.valves.comfy_viewer_url}/api/workflows/${schema.workflowId}/trigger"
        payload = {
${payloadEntries}
        }

        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
            job_id = result.get("jobId")

            if not result.get("ok"):
                return f"Failed to queue workflow: {result}"

            # Poll for completion (up to 10 minutes)
            for _ in range(120):
                time.sleep(5)
                status_resp = requests.get(
                    f"{self.valves.comfy_viewer_url}/api/jobs/{job_id}",
                    timeout=10
                )
                status_resp.raise_for_status()
                job = status_resp.json().get("job", {})
                status = job.get("status")

                if status == "completed":
                    outputs = job.get("outputs", [])
                    image_urls = [
                        f"{self.valves.comfy_viewer_url}/images/{o['imagePath']}"
                        for o in outputs if o.get("exists", True)
                    ]
                    return (
                        f"Workflow completed! Generated {len(image_urls)} image(s):\\n"
                        + "\\n".join(image_urls)
                    )
                elif status in ("error", "cancelled"):
                    error = job.get("errorMessage", "Unknown error")
                    return f"Workflow {status}: {error}"

            return f"Workflow still running after timeout. Job ID: {job_id}"
        except Exception as e:
            return f"Error triggering workflow: {str(e)}"
`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
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

  const openWebUiTool = schema ? generateOpenWebUiTool(schema, baseUrl) : '';

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
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Paste this into Open WebUI &rarr; Workspace &rarr; Tools &rarr; Create Tool.
                    Configure the server URL in the tool's Valves settings.
                  </p>
                  <div className="flex justify-end">
                    <CopyButton text={openWebUiTool} />
                  </div>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap break-all">
                    {openWebUiTool}
                  </pre>
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
