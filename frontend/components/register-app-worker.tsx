"use client";

import { useEffect } from "react";

export default function RegisterAppWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // The site still works normally when service workers are unavailable.
      });
    }
  }, []);

  return null;
}
