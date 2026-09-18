import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LoadingProvider } from './context/LoadingContext';
import { GlobalLoadingBar } from './components/common/GlobalLoadingBar';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <LoadingProvider>
        <GlobalLoadingBar />
        <App />
      </LoadingProvider>
    </AuthProvider>
  </StrictMode>,
);
