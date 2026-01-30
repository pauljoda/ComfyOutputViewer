import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import GalleryPage from './pages/GalleryPage';
import WorkflowsPage from './pages/WorkflowsPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<GalleryPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/:workflowId" element={<WorkflowsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
