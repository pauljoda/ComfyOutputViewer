# Plan: External Workflow Trigger API + MCP Server + Open WebUI Integration

## Context

The app currently only allows running workflows through its web UI. The existing `POST /api/workflows/:id/run` endpoint uses internal input IDs (`{ inputs: [{ inputId: 900, value: "..." }] }`), making it unsuitable for external callers. This plan adds a human-friendly trigger API, an MCP server for AI tool integration, and an export UI for easy Open WebUI setup.

**Scope restriction:** Text-based inputs only (text, negative, number, seed). Image inputs are excluded.

---

## Step 1: Add trigger + schema endpoints to `registerWorkflowRoutes.js`

**File:** `src/server/routes/registerWorkflowRoutes.js`

Extract the prompt-building + job-creation + ComfyUI-queueing logic (lines 444-576 of the current `/run` handler) into a local helper function `executeWorkflowFromInputMap({ workflowId, workflowRow, workflowInputs, inputValuesMap })`. This avoids duplicating ~130 lines between `/run` and `/trigger`. The existing `/run` handler keeps its input-ID-based parsing and image handling, then delegates to this helper. The image-specific `parseImageValue` / `formatJobInputValue` functions stay in `/run`'s path only.

### `GET /api/workflows/:id/trigger-schema`

Returns the external API contract for a workflow:
```json
{
  "workflowId": 3,
  "workflowName": "SDXL txt2img",
  "endpoint": "/api/workflows/3/trigger",
  "method": "POST",
  "contentType": "application/json",
  "fields": [
    { "label": "Positive Prompt", "key": "prompt", "type": "text", "defaultValue": "a cat", "required": false },
    { "label": "Steps", "key": "steps", "type": "number", "defaultValue": "30", "required": false }
  ],
  "example": { "Positive Prompt": "a beautiful sunset", "Steps": "30" }
}
```

Only includes inputs where `input_type` is in `{text, negative, number, seed}`. Fields with a `default_value` are `required: false`; fields without are `required: true`.

### `POST /api/workflows/:id/trigger`

Accepts a flat JSON body using labels or input keys as property names:
```json
{ "Positive Prompt": "a sunset over mountains", "Steps": "25" }
```

**Matching logic:** For each text-based workflow input, try matching a request body key by:
1. Label (case-insensitive, trimmed)
2. input_key (case-insensitive, trimmed)
3. Fall back to `default_value` if no match
4. If no default exists and the field is unmatched, leave the node value untouched in the prompt JSON

After resolving all inputs into an `inputValuesMap`, delegates to the shared `executeWorkflowFromInputMap` helper. Returns:
```json
{ "ok": true, "jobId": 105, "promptId": "abc-123" }
```

Job status can then be polled via the existing `GET /api/jobs/:id` endpoint.

### Refactoring details

The `executeWorkflowFromInputMap` helper encapsulates:
- Cloning `workflowRow.api_json` into a prompt JSON object
- Iterating `workflowInputs` and applying values from `inputValuesMap` to prompt nodes
  - number/seed types: `Number()` conversion
  - text/negative types: string pass-through
  - image types: only handled by `/run`, not by the shared helper (image inputs are skipped)
- Creating a job record via `statements.insertJob`
- Saving job inputs via `statements.insertJobInput`
- Broadcasting the new job via `broadcastJobUpdate`
- Queueing the prompt to ComfyUI via `api.queuePrompt`
- Updating job with prompt ID and status
- Starting background `pollJobCompletion`
- Returning `{ jobId, promptId }`

The `resolveTriggeredInputValues(workflowInputs, body)` function is a standalone helper:
- Filters to `TEXT_TYPES = {text, negative, number, seed}`
- Builds a lowercased/trimmed lookup map from the request body keys
- For each workflow input: match by label, then input_key, then default_value
- Returns a `Map<inputId, stringValue>`

Both of these functions need to be returned from `registerWorkflowRoutes` so the MCP server can use them (see Step 3).

---

## Step 2: Export API modal in the UI

### New file: `src/client/components/workflows/ExportApiModal.tsx`

A dialog component using the existing Radix Dialog from `src/client/components/ui/dialog.tsx` with tabbed content sections. Fetches `/api/workflows/:id/trigger-schema` when opened.

**Tabs:**

1. **JSON** - Example payload formatted and ready to copy
2. **curl** - Complete curl command using `window.location.origin` as base URL:
   ```bash
   curl -X POST http://localhost:8008/api/workflows/3/trigger \
     -H "Content-Type: application/json" \
     -d '{
       "Positive Prompt": "a beautiful sunset",
       "Steps": "30"
     }'
   ```
3. **Open WebUI Tool** - Auto-generated Python tool script (see Step 4)

Each tab has a copy-to-clipboard button using `navigator.clipboard.writeText()`.

**Component structure:**
- Props: `workflowId: number`, `open: boolean`, `onOpenChange: (open: boolean) => void`
- State: `activeTab` (string), `schema` (fetched data), `loading`, `copied` (for copy feedback)
- Fetches schema via `api<TriggerSchema>(\`/api/workflows/${workflowId}/trigger-schema\`)` in a `useEffect` when `open` becomes true

### Modify: `src/client/components/workflows/WorkflowDetail.tsx`

Add an "Export API" button next to the existing "Run Workflow" button at line 811-815.

Current code:
```tsx
<div>
  <Button onClick={handleRun} disabled={running}>
    {running ? 'Running...' : 'Run Workflow'}
  </Button>
</div>
```

Changed to:
```tsx
<div className="flex gap-2">
  <Button onClick={handleRun} disabled={running}>
    {running ? 'Running...' : 'Run Workflow'}
  </Button>
  <Button variant="outline" size="sm" onClick={() => setExportApiOpen(true)}>
    <Code2 className="mr-1 h-3.5 w-3.5" />
    API
  </Button>
</div>
```

Plus the `ExportApiModal` rendered at the bottom of the component JSX.

---

## Step 3: MCP server

### Install: `@modelcontextprotocol/sdk`

Add to `dependencies` in `package.json`. Run `npm install`. Run `scripts/update-npm-deps-hash.sh` for the Nix flake.

### New file: `src/server/mcp/createMcpServer.js`

Factory function following the project's dependency-injection pattern. Creates an `McpServer` instance with three tools:

#### `list_workflows`

- No parameters
- Iterates `statements.selectWorkflows` and for each workflow iterates `statements.selectWorkflowInputs`
- Filters inputs to text-based types only
- Returns JSON array of workflows with their input schemas
- Purpose: lets the AI discover available workflows and what inputs they accept

#### `run_workflow`

- Parameters: `workflowId` (number), `inputs` (object of label-to-value string pairs)
- Calls `resolveTriggeredInputValues(workflowInputs, inputs)` to build the input values map
- Calls `executeWorkflowFromInputMap(...)` to build prompt, create job, queue to ComfyUI
- Returns `{ ok, jobId, promptId }` or error message
- Purpose: lets the AI trigger a generation with custom inputs

#### `get_job_status`

- Parameters: `jobId` (number)
- Calls `buildJobPayload(jobId)` to get full job state
- Returns status, error message, output image paths, progress info
- Purpose: lets the AI check if a generation is done and get the results

**Dependencies passed in:**
- `statements` (for DB queries in list_workflows)
- `resolveTriggeredInputValues` (from registerWorkflowRoutes return value)
- `executeWorkflowFromInputMap` (from registerWorkflowRoutes return value)
- `buildJobPayload` (from registerWorkflowRoutes return value)

### Modify: `src/server/routes/registerWorkflowRoutes.js`

Change `registerWorkflowRoutes` from returning `void` to returning an object:
```javascript
return { buildJobPayload, resolveTriggeredInputValues, executeWorkflowFromInputMap };
```

This requires `resolveTriggeredInputValues` and `executeWorkflowFromInputMap` to be defined as named functions (not inline anonymous handlers).

### Modify: `src/server/index.js`

After `registerWorkflowRoutes(...)`:

1. Destructure the returned functions:
   ```javascript
   const { buildJobPayload, resolveTriggeredInputValues, executeWorkflowFromInputMap } =
     registerWorkflowRoutes(app, { ...deps });
   ```

2. Import and create MCP server:
   ```javascript
   import { createMcpServer } from './mcp/createMcpServer.js';
   ```

3. Create MCP server instance with dependencies

4. Mount SSE transport routes:
   - `GET /mcp/sse` - Client connects here for the SSE event stream. Creates a new `SSEServerTransport`, stores it by session ID, calls `mcpServer.connect(transport)`.
   - `POST /mcp/messages` - Client sends JSON-RPC messages here. Looks up transport by `sessionId` query param, calls `transport.handlePostMessage(req, res)`.
   - Track transports in a `Map<sessionId, transport>`, clean up on connection close.

### Modify: `vite.config.ts`

Add `/mcp` to the dev proxy config:
```typescript
proxy: {
  '/api': 'http://localhost:8009',
  '/images': 'http://localhost:8009',
  '/mcp': 'http://localhost:8009'
}
```

---

## Step 4: Open WebUI Python tool generator

Built into the Export API modal (Step 2, "Open WebUI Tool" tab). The Python script is generated client-side from the trigger-schema response.

The generated script follows Open WebUI's Tools format:

```python
"""
ComfyUI Workflow: {workflowName}
Auto-generated Open WebUI Tool for triggering workflow #{workflowId}
"""

import time
import requests
from pydantic import BaseModel, Field


class Tools:
    class Valves(BaseModel):
        comfy_viewer_url: str = Field(
            default="http://localhost:8008",
            description="Base URL of the Comfy Output Viewer server"
        )

    def __init__(self):
        self.valves = self.Valves()

    def run_{snake_name}(
        self,
        {param_definitions}
    ) -> str:
        """
        Run the {workflowName} ComfyUI workflow.
        {field_descriptions}
        """
        url = f"{self.valves.comfy_viewer_url}/api/workflows/{workflowId}/trigger"
        payload = {
            {payload_entries}
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
                        f"Workflow completed! Generated {len(image_urls)} image(s):\n"
                        + "\n".join(image_urls)
                    )
                elif status in ("error", "cancelled"):
                    error = job.get("errorMessage", "Unknown error")
                    return f"Workflow {status}: {error}"

            return f"Workflow still running after timeout. Job ID: {job_id}"
        except Exception as e:
            return f"Error triggering workflow: {str(e)}"
```

**Template variable generation:**
- `{snake_name}`: workflow name converted to snake_case
- `{param_definitions}`: one Python parameter per schema field, e.g. `positive_prompt: str = "default value",`
- `{payload_entries}`: maps Python param names back to labels, e.g. `"Positive Prompt": positive_prompt,`
- `{field_descriptions}`: human-readable field list for the docstring
- `{workflowId}` and `{workflowName}`: from the schema response
- The `Valves.comfy_viewer_url` default is set to `window.location.origin` at generation time

---

## Step 5: Tests

### Modify: `src/server/routes/registerWorkflowRoutes.test.js`

Add test cases using the existing `createBaseDeps` test helper pattern:

1. **`POST /trigger` maps label-based keys and queues workflow** - Send `{ "Prompt": "test" }`, verify label "Prompt" resolves to the correct input, job is created, ComfyUI prompt is queued, response has `{ ok: true, jobId, promptId }`
2. **`POST /trigger` falls back to input_key matching** - Send `{ "prompt": "test" }` (matching input_key not label), verify it works
3. **`POST /trigger` uses defaults for missing inputs** - Send `{}`, verify defaults are applied
4. **`POST /trigger` skips image inputs** - Ensure image-type inputs are not included in resolution
5. **`POST /trigger` returns 404 for missing workflow** - Send to `/api/workflows/999/trigger`
6. **`GET /trigger-schema` returns correct schema** - Verify fields, example, endpoint info

### New file: `src/server/mcp/createMcpServer.test.js`

Test MCP tool handlers with mocked dependencies:
1. `list_workflows` returns correct structure with filtered inputs
2. `run_workflow` resolves inputs and returns job info
3. `run_workflow` returns error for missing workflow
4. `get_job_status` returns job data
5. `get_job_status` returns error for missing job

---

## Step 6: Versioning and documentation

- Bump `package.json` version to `0.9.0` (new feature: external API + MCP)
- Add `CHANGELOG.md` entry describing:
  - External trigger API (`POST /trigger`, `GET /trigger-schema`)
  - MCP server with `list_workflows`, `run_workflow`, `get_job_status` tools
  - Export API modal with curl, JSON, and Open WebUI tool generation
- Update `AGENTS.md`:
  - Add new API endpoints to the endpoint list
  - Add MCP server info
  - Update current projects / recent changes
- Run `scripts/update-npm-deps-hash.sh` for the Nix flake
- Commit all changes

---

## Files Modified/Created Summary

| Action | File |
|--------|------|
| Modify | `src/server/routes/registerWorkflowRoutes.js` — extract helper, add trigger/schema endpoints, return shared functions |
| Modify | `src/server/index.js` — wire MCP server, mount SSE routes, destructure returned functions |
| Modify | `src/client/components/workflows/WorkflowDetail.tsx` — add Export API button + modal |
| Modify | `vite.config.ts` — add `/mcp` proxy |
| Modify | `package.json` — add `@modelcontextprotocol/sdk`, bump version |
| Create | `src/client/components/workflows/ExportApiModal.tsx` — export dialog with tabs |
| Create | `src/server/mcp/createMcpServer.js` — MCP server factory with three tools |
| Modify | `src/server/routes/registerWorkflowRoutes.test.js` — trigger/schema test cases |
| Create | `src/server/mcp/createMcpServer.test.js` — MCP tool tests |
| Modify | `CHANGELOG.md`, `AGENTS.md` — version + docs |

---

## Verification

1. **Trigger endpoint**: `curl -X POST http://localhost:8008/api/workflows/1/trigger -H 'Content-Type: application/json' -d '{"Positive Prompt": "a cat"}'` returns `{ ok: true, jobId, promptId }` and the job appears in the UI
2. **Schema endpoint**: `GET /api/workflows/1/trigger-schema` returns fields, example payload, and endpoint info
3. **Export modal**: Click "API" button on a workflow, verify all tabs show correct content, copy buttons work
4. **MCP**: Connect an MCP client (e.g. `npx @modelcontextprotocol/inspector`) to `http://localhost:8008/mcp/sse`, call `list_workflows`, then `run_workflow`, then `get_job_status`
5. **Open WebUI**: Paste generated Python tool into Open WebUI Tools, configure the valve URL, invoke from a chat
6. **Tests**: `npm run test` passes all existing + new tests
