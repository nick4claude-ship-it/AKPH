import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { validateMockReferences } from './utils/validation';
import { AppStoreProvider } from './store/AppStore';

if (import.meta.env.DEV) {
  validateMockReferences();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStoreProvider>
      <App />
    </AppStoreProvider>
  </StrictMode>,
);
