import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LoadingProvider } from './context/LoadingContext';
import { GlobalLoadingBar } from './components/common/GlobalLoadingBar';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoadingProvider>
      <GlobalLoadingBar />
      <App />
    </LoadingProvider>
  </StrictMode>,
);
