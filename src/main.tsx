import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateMockReferences } from './utils/validation';
import { AppStoreProvider } from './store/AppStore';
import { HashRouter } from 'react-router-dom';

if (import.meta.env.DEV) {
  validateMockReferences();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </AppStoreProvider>
  </StrictMode>,
);
