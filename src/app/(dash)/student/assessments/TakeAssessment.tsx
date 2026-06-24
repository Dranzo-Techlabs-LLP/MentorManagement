"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, CheckCircle2, Send } from "lucide-react";

type Option = { label: string; value: number };
type Question = { id: string; text: string; options: Option[] };
type Result = { ok: boolean; error?: string; id?: string };

/**
 * TakeAssessment — friendly questionnaire form.
 * Renders each question with radio inputs named `q_<questionId>` and submits
 * via the provided server action (uses progressive enhancement <form action>).
 */
export function TakeAssessment({
  id,
  title,
  questions,
  action,
}: {
  id: string;
  title: string;
  questions: Question[];
  action: (fd: FormData) => Promise<Result>;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const answeredCount = Object.keys(answers).length;
  const total = questions.length;
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <form
      action={async (fd) => {
        setError("");
        const res = await action(fd);
        if (!res?.ok) setError(res?.error || "Something went wrong. Please try again.");
      }}
      className="space-y-5"
    >
      <input type="hidden" name="id" value={id} />

      {/* Progress */}
      <div className="sticky top-0 z-10 rounded-xl border border-slate-100 bg-white/90 p-4 backdrop-blur">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-semibold text-navy">{title}</span>
          <span className="text-slate-500">
            {answeredCount} / {total} answered
          </span>
        </div>
        <div className="progress">
          <span style={{ width: `${pct}%`, background: "#2FA84F" }} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>
      )}

      {questions.map((q, qi) => {
        const selected = answers[q.id];
        return (
          <div key={q.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <p className="mb-3 flex gap-2 text-sm font-semibold text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy">
                {qi + 1}
              </span>
              {q.text}
            </p>
            <div className="grid gap-2">
              {q.options.map((opt, oi) => {
                const active = selected === opt.value;
                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
                      active
                        ? "border-leaf bg-leaf-50 font-semibold text-leaf-700"
                        : "border-slate-200 text-slate-600 hover:border-navy hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q_${q.id}`}
                      value={opt.value}
                      className="sr-only"
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.value }))}
                      required
                    />
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        active ? "border-leaf bg-leaf" : "border-slate-300"
                      }`}
                    >
                      {active && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </span>
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Answer all questions, then submit to see your results.</p>
        <Submit disabled={answeredCount < total} />
      </div>
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-green" disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
        </>
      ) : (
        <>
          <Send className="h-4 w-4" /> Submit assessment
        </>
      )}
    </button>
  );
}
