import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('BOMA SW registered:', reg.scope);
    }).catch((err) => {
      console.log('SW registration failed:', err);
    });
  });

  // Listen for offline queue messages
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'QUEUE_OFFLINE_ACTION') {
      const queue = JSON.parse(localStorage.getItem('boma_offline_queue') || '[]');
      queue.push(event.data.payload);
      localStorage.setItem('boma_offline_queue', JSON.stringify(queue));
    }
    if (event.data.type === 'REPLAY_OFFLINE_QUEUE') {
      const queue = JSON.parse(localStorage.getItem('boma_offline_queue') || '[]');
      queue.forEach(async (item) => {
        try {
          await fetch(item.url, { method: item.method, headers: item.headers, body: item.body });
        } catch {} // eslint-disable-line no-empty
      });
      localStorage.removeItem('boma_offline_queue');
    }
  });
}
