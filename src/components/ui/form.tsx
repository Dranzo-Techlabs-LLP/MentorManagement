"use client";

import { cloneElement, isValidElement, useId } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={cn(className)} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {pendingText ?? "Saving..."}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Labelled form field. Associates the <label> with its control via htmlFor/id
 * (generating an id when the child doesn't supply one) so the label is announced
 * by screen readers and resolvable by label-based queries.
 */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;

  let control = children;
  let controlId: string | undefined;
  if (isValidElement<{ id?: string; "aria-describedby"?: string }>(children)) {
    controlId = children.props.id ?? generatedId;
    control = cloneElement(children, {
      id: controlId,
      "aria-describedby": hint ? (children.props["aria-describedby"] ?? hintId) : children.props["aria-describedby"],
    });
  }

  return (
    <div>
      <label className="label" htmlFor={controlId}>
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}
