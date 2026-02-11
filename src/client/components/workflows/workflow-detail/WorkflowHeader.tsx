import { Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import type { Workflow } from '../../../types';

type WorkflowHeaderProps = {
  workflow: Workflow;
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  onDelete: (workflow: Workflow) => void;
};

export default function WorkflowHeader({
  workflow,
  editMode,
  onEditModeChange,
  onDelete
}: WorkflowHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{workflow.name}</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editMode}
              onChange={(event) => onEditModeChange(event.target.checked)}
              className="accent-primary"
            />
            Edit Mode
          </label>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(workflow)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {workflow.description && (
        <p className="text-sm text-muted-foreground">{workflow.description}</p>
      )}
    </>
  );
}
