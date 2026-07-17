"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

type Toast = { id: number; message: string };

/** Outside a ToastProvider this is a no-op, so ActionForm stays safe to use anywhere. */
const ToastContext = createContext<(message: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const DURATION_MS = 4000;

/**
 * Minimal toast stack. Lives at the root so a toast outlives the modal that
 * triggered it — a form inside a Modal unmounts on success, which is why
 * success feedback can't be rendered inside the form itself.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-leaf/30 bg-white px-4 py-3 shadow-cardhover"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
            <p className="flex-1 text-sm font-medium text-slate-700">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
