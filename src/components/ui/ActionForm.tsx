"use client";

import { useState } from "react";
import { useModalClose } from "./Modal";

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
  successMessage?: string;
}) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const closeModal = useModalClose();

  return (
    <form
      className={className}
      action={async (fd) => {
        setError("");
        setDone(false);
        const res = await action(fd);
        if (res?.ok) {
          onDone?.();
          closeModal(); // no-op when not inside a Modal
          if (successMessage) setDone(true);
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
      {done && successMessage && (
        <div className="mb-3 rounded-lg bg-leaf-50 px-3 py-2 text-sm font-medium text-leaf-700">{successMessage}</div>
      )}
      {children}
    </form>
  );
}
