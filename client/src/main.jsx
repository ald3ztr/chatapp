import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initTheme } from './theme.js';

// Tema, React render olmadan once uygulanir (yaniip parlamasini onler)
initTheme();

// PWA service worker kaydi (telefon ana ekranina eklenebilsin, uygulama gibi acilsin)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
