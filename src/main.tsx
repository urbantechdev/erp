import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Shield against external Chrome extension disconnects and benign ResizeObserver loops
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = event.message || '';
      const filename = event.filename || '';
      if (
        filename.includes('chrome-extension://') ||
        filename.includes('moz-extension://') ||
        msg.includes('Could not establish connection') ||
        msg.includes('Receiving end does not exist') ||
        msg.includes('message channel closed') ||
        msg.includes('ResizeObserver loop')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reasonMsg = String(event.reason?.message || event.reason || '');
      const reasonStack = String(event.reason?.stack || '');
      if (
        reasonMsg.includes('Could not establish connection') ||
        reasonMsg.includes('Receiving end does not exist') ||
        reasonMsg.includes('message channel closed') ||
        reasonStack.includes('chrome-extension://') ||
        reasonStack.includes('moz-extension://')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return true;
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

