import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and prevent uncaught runtime assertions from browser extensions or @firebase/auth popup race conditions
const shouldSuppressError = (msg: string, stack: string = '', filename: string = '') => {
  const combined = `${msg} ${stack} ${filename}`;
  return (
    combined.includes('Could not establish connection') ||
    combined.includes('Receiving end does not exist') ||
    combined.includes('chrome-extension://') ||
    combined.includes('moz-extension://') ||
    combined.includes('safari-extension://') ||
    combined.includes('Pending promise was never set') ||
    combined.includes('popup-closed-by-user') ||
    combined.includes('cancelled-popup-request')
  );
};

window.addEventListener(
  'unhandledrejection',
  (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    const stack = String(reason?.stack || '');
    if (shouldSuppressError(msg, stack)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('[Handled Unhandled Rejection]:', msg);
    }
  },
  true
);

window.addEventListener(
  'error',
  (event) => {
    const msg = String(event.message || event.error?.message || '');
    const stack = String(event.error?.stack || '');
    const filename = String(event.filename || '');
    if (shouldSuppressError(msg, stack, filename)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('[Handled Window Error]:', msg);
      return true;
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(<App />);
