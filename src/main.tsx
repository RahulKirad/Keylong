import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './style.css';
import App from './App';
import { initSyncEngine } from './syncEngine';

// Initialize real-time universal cloud sync across all devices
initSyncEngine();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);