"use client";

import { useState, useId } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./form";

type Result = { ok: boolean; error?: string };

/**
 * Reusable delete confirmation: trigger button → modal warning → submits `action`.
 * Errors from the action (e.g. "cannot delete — has active sessions") render inline,
 * so a blocked delete explains itself instead of failing silently.
 */
export function ConfirmDeleteButton({
  action,
  hiddenFields,
  itemLabel,
  warning,
  triggerLabel,
  triggerClassName = "btn-ghost text-red-600",
  onDone,
}: {
  action: (fd: FormData) => Promise<Result>;
  hiddenFields: Record<string, string>;
  itemLabel: string;
  warning?: string;
  triggerLabel?: React.ReactNode;
  triggerClassName?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel ?? (
          <>
            <Trash2 className="h-4 w-4" /> Delete
          </>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-cardhover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 id={titleId} className="font-bold text-navy">Delete {itemLabel}?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {warning ?? "This action is permanent and cannot be undone."}
                </p>
              </div>
            </div>
            <ActionForm
              action={action}
              className="mt-4"
              onDone={() => {
                setOpen(false);
                onDone?.();
              }}
            >
              {Object.entries(hiddenFields).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <SubmitButton className="btn-danger" pendingText="Deleting…">
                  Delete
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
