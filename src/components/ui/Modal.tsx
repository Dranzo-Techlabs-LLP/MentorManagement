"use client";

import { useState, useEffect, createContext, useContext, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ModalCloseContext = createContext<() => void>(() => {});
/** Inside a Modal, returns a fn that closes it. Outside, a no-op. */
export const useModalClose = () => useContext(ModalCloseContext);

export function Modal({
  title,
  triggerLabel,
  triggerClassName = "btn-primary",
  children,
  wide,
}: {
  title: string;
  /** Content of the trigger button (text + icons). */
  triggerLabel: React.ReactNode;
  /** Class applied to the trigger button. */
  triggerClassName?: string;
  /** Dialog body — typically an <ActionForm> which auto-closes on success. */
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape — expected dialog behaviour for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn("w-full rounded-2xl bg-white shadow-cardhover", wide ? "max-w-2xl" : "max-w-lg")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 id={titleId} className="font-bold text-navy">{title}</h3>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-5">
              <ModalCloseContext.Provider value={() => setOpen(false)}>{children}</ModalCloseContext.Provider>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
