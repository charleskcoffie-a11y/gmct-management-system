import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// --- Global Failsafe Error Handler ---
const handleError = (errorEvent: ErrorEvent | PromiseRejectionEvent | { error: any }) => {
  try {
    if ('preventDefault' in errorEvent && typeof errorEvent.preventDefault === 'function') {
      errorEvent.preventDefault();
    }
    
    const error = 'reason' in errorEvent ? errorEvent.reason : errorEvent.error;
    console.error("GMCT App Global Error Handler caught:", error);

    const rootElement = document.getElementById('root');
    if (rootElement) {
      const message = error?.message || String(error) || 'An unknown error occurred.';
      const stack = error?.stack || 'No stack trace available.';
      
      rootElement.innerHTML = '';
      rootElement.style.padding = '1.5rem';
      rootElement.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
      rootElement.style.color = '#B91C1C';
      
      const title = document.createElement('h1');
      title.textContent = 'Application Failed to Load';
      title.style.fontSize = '1.5rem';
      title.style.fontWeight = 'bold';
      
      const preamble = document.createElement('p');
      preamble.textContent = 'A critical error prevented the application from starting. Please check the browser\'s developer console and report the technical details below.';
      preamble.style.marginTop = '1rem';

      const details = document.createElement('pre');
      details.textContent = `Error: ${message}\n\nStack Trace:\n${stack}`;
      details.style.marginTop = '1rem';
      details.style.padding = '1rem';
      details.style.backgroundColor = '#FEF2F2';
      details.style.border = '1px solid #F87171';
      details.style.borderRadius = '0.5rem';
      details.style.whiteSpace = 'pre-wrap';
      details.style.wordWrap = 'break-word';
      details.style.fontFamily = 'ui-monospace, monospace';

      rootElement.appendChild(title);
      rootElement.appendChild(preamble);
      rootElement.appendChild(details);
    }
  } catch (e) {
    console.error("FATAL: The global error handler itself has crashed.", e);
    alert("A critical error occurred, and the error handler also failed. Please check the console for details.");
  }
};

window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', handleError as (e: PromiseRejectionEvent) => void);
// --- End of Failsafe ---

// --- App Initialization ---
const initialize = () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error("Fatal: Could not find the #root element in the HTML to mount the application.");
    }
    
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    handleError({ error: error });
  }
};

initialize();