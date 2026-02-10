import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const TEXT_INPUT_TYPES = new Set(['text', 'negative', 'number', 'seed']);

export function createMcpServer({
  statements,
  resolveTriggeredInputValues,
  executeWorkflowFromInputMap,
  buildJobPayload
}) {
  const server = new McpServer({
    name: 'comfy-output-viewer',
    version: '1.0.0'
  });

  server.tool(
    'list_workflows',
    'List all available ComfyUI workflows with their IDs, names, and text-based input fields. Call this first to discover what workflows are available before running one.',
    {},
    async () => {
      const workflows = [];
      for (const row of statements.selectWorkflows.iterate()) {
        const inputs = [];
        for (const input of statements.selectWorkflowInputs.iterate(row.id)) {
          if (!TEXT_INPUT_TYPES.has(input.input_type)) continue;
          inputs.push({
            label: input.label,
            key: input.input_key,
            type: input.input_type,
            defaultValue: input.default_value ?? null
          });
        }
        workflows.push({
          id: row.id,
          name: row.name,
          description: row.description || null,
          inputs
        });
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(workflows, null, 2)
        }]
      };
    }
  );

  server.tool(
    'run_workflow',
    'Trigger a ComfyUI workflow with the given text-based inputs. Use list_workflows first to see available workflows and their input fields. Pass inputs as label-to-value pairs.',
    {
      workflowId: z.number().describe('The workflow ID to run (get this from list_workflows)'),
      inputs: z.record(z.string(), z.string()).describe('Input values as label-to-value pairs, e.g. {"Positive Prompt": "a cat sitting on a windowsill", "Steps": "30"}')
    },
    async ({ workflowId, inputs }) => {
      try {
        const workflowRow = statements.selectWorkflowById.get(workflowId);
        if (!workflowRow) {
          return {
            content: [{ type: 'text', text: `Error: Workflow ${workflowId} not found` }],
            isError: true
          };
        }

        const workflowInputs = [];
        for (const row of statements.selectWorkflowInputs.iterate(workflowId)) {
          workflowInputs.push(row);
        }

        const inputValuesMap = resolveTriggeredInputValues(workflowInputs, inputs);
        const result = await executeWorkflowFromInputMap({ workflowId, inputValuesMap });

        if (!result.ok) {
          return {
            content: [{ type: 'text', text: `Error queuing workflow: ${result.error}` }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: true,
              jobId: result.jobId,
              promptId: result.promptId,
              message: `Workflow "${workflowRow.name}" queued successfully. Use get_job_status with jobId ${result.jobId} to check progress and get output images.`
            }, null, 2)
          }]
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message || String(err)}` }],
          isError: true
        };
      }
    }
  );

  server.tool(
    'get_job_status',
    'Check the status of a workflow job and get its output image paths. Returns status (pending/queued/running/completed/error/cancelled), progress info, and output image URLs when completed.',
    {
      jobId: z.number().describe('The job ID returned from run_workflow')
    },
    async ({ jobId }) => {
      const job = buildJobPayload(jobId);
      if (!job) {
        return {
          content: [{ type: 'text', text: `Error: Job ${jobId} not found` }],
          isError: true
        };
      }

      const summary = {
        id: job.id,
        status: job.status,
        errorMessage: job.errorMessage || null,
        createdAt: job.createdAt,
        completedAt: job.completedAt || null,
        outputs: (job.outputs || []).map((o) => ({
          imagePath: o.imagePath,
          imageUrl: `/images/${o.imagePath}`,
          exists: o.exists
        })),
        progress: job.progress || null,
        overall: job.overall || null
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2)
        }]
      };
    }
  );

  return server;
}
