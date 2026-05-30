import { initSentry } from "./lib/sentry";
initSentry();

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Fade the inline HTML splash once React has taken over. Minimum 600ms display so
// the brand mark registers instead of flashing for cached/instant loads.
const splash = document.getElementById("initial-splash");
if (splash) {
  const start = performance.now();
  const MIN_DISPLAY_MS = 600;
  requestAnimationFrame(() => {
    const elapsed = performance.now() - start;
    const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
    setTimeout(() => {
      splash.classList.add("fade-out");
      setTimeout(() => splash.remove(), 320);
    }, wait);
  });
}

// Register only in production builds. In dev the cache-first SW serves stale bundles and
// fights Vite HMR; PWA features are tested against `npm run build && npm run start`.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          // New SW activated and has taken control — reload to serve fresh assets
          if (next.state === "activated" && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    });
  });
}
