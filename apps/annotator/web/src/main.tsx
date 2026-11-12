import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

if (typeof window !== "undefined") {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    const root = createRoot(rootEl);
    root.render(<App />);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore service worker registration errors in restricted contexts
      });
    });
  }
}
