import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Shield against external Chrome extension disconnects and benign ResizeObserver loops
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || event.error?.message || '');
      const filename = String(event.filename || '');
      const stack = String(event.error?.stack || '');
      const isExtensionError =
        filename.includes('chrome-extension://') ||
        filename.includes('moz-extension://') ||
        stack.includes('chrome-extension://') ||
        stack.includes('moz-extension://') ||
        msg.includes('Could not establish connection') ||
        msg.includes('Receiving end does not exist') ||
        msg.includes('message channel closed') ||
        msg.includes('Extension context invalidated') ||
        msg.includes('ResizeObserver loop');

      if (isExtensionError) {
        event.preventDefault();
        event.stopPropagation();
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
      
      // Extension connection errors often appear in both message and stack
      const isExtensionError =
        reasonMsg.includes('Could not establish connection') ||
        reasonMsg.includes('Receiving end does not exist') ||
        reasonMsg.includes('message channel closed') ||
        reasonMsg.includes('Extension context invalidated') ||
        reasonStack.includes('chrome-extension://') ||
        reasonStack.includes('moz-extension://');

      if (isExtensionError) {
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

