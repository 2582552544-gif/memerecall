"use client";

import { useEffect } from "react";

function isExtensionOriginError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const stack = error instanceof Error ? error.stack || "" : "";
  return (
    message.includes("Origin not allowed") &&
    stack.includes("chrome-extension://")
  );
}

export function ExtensionErrorFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const onError = (event: ErrorEvent) => {
      if (!isExtensionOriginError(event.error)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isExtensionOriginError(event.reason)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection, true);

    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection, true);
    };
  }, []);

  return null;
}
