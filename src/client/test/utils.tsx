import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { TagsProvider } from '../contexts/TagsContext';

export function renderWithRouter(ui: ReactNode, initialEntries: string[] = ['/']) {
  return render(
    <TagsProvider>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </TagsProvider>
  );
}

export function renderWithRoutes(
  appElement: ReactNode,
  childElement: ReactNode,
  initialEntries: string[] = ['/']
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={appElement}>
          <Route index element={childElement} />
          <Route path="workflows" element={childElement} />
          <Route path="workflows/:workflowId" element={childElement} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
