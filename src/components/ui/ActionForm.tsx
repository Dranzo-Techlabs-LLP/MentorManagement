"use client";

import { useState } from "react";
import { useModalClose } from "./Modal";
import { useToast } from "./Toast";

type Result = { ok: boolean; error?: string; id?: string };

export function ActionForm({
  action,
  children,
  onDone,
  className,
  resetOnSuccess,
  successMessage,
}: {
  action: (fd: FormData) => Promise<Result>;
  children: React.ReactNode;
  onDone?: () => void;
  className?: string;
  resetOnSuccess?: boolean;
  /** Shown as a toast on success. Toasts live at the root, so the message
   *  survives this form unmounting when it sits inside a Modal. */
  successMessage?: string;
}) {
  const [error, setError] = useState("");
  const closeModal = useModalClose();
  const toast = useToast();

  return (
    <form
      className={className}
      action={async (fd) => {
        setError("");
        const res = await action(fd);
        if (res?.ok) {
          onDone?.();
          if (successMessage) toast(successMessage);
          closeModal(); // no-op when not inside a Modal
          if (resetOnSuccess) {
            const form = document.activeElement?.closest("form");
            (form as HTMLFormElement | null)?.reset();
          }
        } else {
          setError(res?.error || "Something went wrong. Please try again.");
        }
      }}
    >
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>
      )}
      {children}
    </form>
  );
}
