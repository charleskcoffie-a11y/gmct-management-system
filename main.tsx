import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppWithToasts } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AppWithToasts />
  </React.StrictMode>
);
