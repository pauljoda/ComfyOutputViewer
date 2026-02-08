import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowsPage from './WorkflowsPage';

vi.mock('../components/workflows/WorkflowsWorkspace', () => ({
  default: () => <div>Workflows Workspace Mock</div>
}));

describe('WorkflowsPage', () => {
  it('renders workflows workspace', () => {
    render(<WorkflowsPage />);
    expect(screen.getByText('Workflows Workspace Mock')).toBeInTheDocument();
  });
});
