import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@renderer/app/App';
import { AppProviders } from '@renderer/app/providers';
import { ErrorBoundary } from '@renderer/app/ErrorBoundary';
import { ensureSceneSiftBridge } from '@renderer/qa/installBridge';
import '@renderer/styles/globals.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root container not found.');
}

ensureSceneSiftBridge();

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
