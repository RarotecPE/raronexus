"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // O registro e opcional; o Nexus segue funcionando se o browser bloquear.
    });
  }, []);

  return null;
}
