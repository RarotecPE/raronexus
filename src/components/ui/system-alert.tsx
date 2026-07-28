"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

export type SystemAlertType = "success" | "error" | "warning";

type SystemAlertProps = {
  message: string;
  type?: SystemAlertType;
  duration?: number;
  onClose: () => void;
};

export function SystemAlert({
  message,
  type = "success",
  duration = 3200,
  onClose,
}: SystemAlertProps) {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const startedAt = Date.now();
    let closeTimeout: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setIsExiting(true);
        closeTimeout = setTimeout(() => onCloseRef.current(), 250);
      }
    }, 50);

    return () => {
      clearInterval(interval);
      if (closeTimeout) clearTimeout(closeTimeout);
    };
  }, [duration]);

  const styles = {
    success: {
      bg: "bg-emerald-950/95 sm:bg-emerald-500/15",
      border: "border-emerald-700/70 sm:border-emerald-500/30",
      text: "text-emerald-200 sm:text-emerald-300",
      progressBg: "bg-emerald-900/70 sm:bg-emerald-500/20",
      progress: "bg-emerald-500",
      icon: <CheckCircle2 size={20} aria-hidden="true" />,
    },
    error: {
      bg: "bg-rose-950/95 sm:bg-rose-500/15",
      border: "border-rose-700/70 sm:border-rose-500/30",
      text: "text-rose-200 sm:text-rose-300",
      progressBg: "bg-rose-900/70 sm:bg-rose-500/20",
      progress: "bg-rose-500",
      icon: <XCircle size={20} aria-hidden="true" />,
    },
    warning: {
      bg: "bg-amber-950/95 sm:bg-amber-500/15",
      border: "border-amber-700/70 sm:border-amber-500/30",
      text: "text-amber-200 sm:text-amber-300",
      progressBg: "bg-amber-900/70 sm:bg-amber-500/20",
      progress: "bg-amber-500",
      icon: <AlertTriangle size={20} aria-hidden="true" />,
    },
  };

  const style = styles[type];

  function close() {
    setIsExiting(true);
    setTimeout(() => onCloseRef.current(), 250);
  }

  return (
    <div
      role="alert"
      className={`fixed left-4 right-4 top-20 z-[100] w-auto transform transition-all duration-300 sm:left-auto sm:right-4 sm:max-w-sm ${
        isExiting ? "translate-y-1 opacity-0 sm:translate-x-full" : "translate-y-0 opacity-100 sm:translate-x-0"
      }`}
    >
      <div className={`${style.bg} ${style.border} overflow-hidden rounded-xl border shadow-2xl ring-1 ring-black/30 backdrop-blur-md`}>
        <div className="flex items-start gap-3 p-4">
          <div className={`shrink-0 ${style.text}`}>{style.icon}</div>
          <p className={`min-w-0 flex-1 text-sm font-medium ${style.text}`}>{message}</p>
          <button
            className={`shrink-0 opacity-60 transition hover:opacity-100 ${style.text}`}
            type="button"
            onClick={close}
            title="Fechar alerta"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={`h-1 ${style.progressBg}`}>
          <div
            className={`h-full ${style.progress} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
