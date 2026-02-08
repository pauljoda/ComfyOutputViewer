import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.fn();

vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => false
}));

vi.mock('../../lib/api', () => ({
  api: (...args) => apiMock(...args)
}));

vi.mock('./WorkflowDetail', () => ({
  default: ({ workflow }) => <div data-testid="workflow-detail">Detail: {workflow.name}</div>
}));

vi.mock('./WorkflowEditorPanel', () => ({
  default: () => <div data-testid="workflow-editor">Editor</div>
}));

import WorkflowsWorkspace from './WorkflowsWorkspace';

describe('WorkflowsWorkspace', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('loads workflows and renders selected workflow detail', async () => {
    apiMock
      .mockResolvedValueOnce({
        workflows: [
          {
            id: 1,
            name: 'Portrait',
            description: 'desc',
            apiJson: {},
            folderId: null,
            sortOrder: 0,
            createdAt: 1,
            updatedAt: 1
          }
        ]
      })
      .mockResolvedValueOnce({ folders: [] });

    render(
      <MemoryRouter initialEntries={['/workflows/1']}>
        <Routes>
          <Route path="/workflows/:workflowId" element={<WorkflowsWorkspace />} />
          <Route path="/workflows" element={<WorkflowsWorkspace />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Portrait')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /portrait/i }));
    expect(screen.getByTestId('workflow-detail')).toHaveTextContent('Detail: Portrait');
  });

  it('opens import editor', async () => {
    apiMock
      .mockResolvedValueOnce({ workflows: [], })
      .mockResolvedValueOnce({ folders: [] });

    render(
      <MemoryRouter initialEntries={['/workflows']}>
        <Routes>
          <Route path="/workflows" element={<WorkflowsWorkspace />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no workflows yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();
  });
});
