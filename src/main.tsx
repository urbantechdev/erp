import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and prevent uncaught runtime assertions from @firebase/auth popup race conditions
window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event.reason?.message || event.reason || '');
  if (
    reason.includes('Pending promise was never set') ||
    reason.includes('popup-closed-by-user') ||
    reason.includes('cancelled-popup-request')
  ) {
    event.preventDefault();
    console.warn('[Firebase Auth Handled Unhandled Rejection]:', reason);
  }
});

window.addEventListener('error', (event) => {
  const msg = String(event.message || event.error?.message || '');
  if (
    msg.includes('Pending promise was never set') ||
    msg.includes('popup-closed-by-user') ||
    msg.includes('cancelled-popup-request')
  ) {
    event.preventDefault();
    console.warn('[Firebase Auth Handled Window Error]:', msg);
  }
});

createRoot(document.getElementById('root')!).render(<App />);
