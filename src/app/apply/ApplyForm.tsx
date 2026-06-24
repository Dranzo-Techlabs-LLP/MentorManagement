"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { submitApplication } from "@/lib/actions";
import { Field } from "@/components/ui/form";

/**
 * ApplyForm — public parent application form.
 * Submits via the `submitApplication` server action; on success it routes
 * to the branded /apply/success thank-you page.
 */
export function ApplyForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <form
      action={async (fd) => {
        setError("");
        const res = await submitApplication(fd);
        if (res?.ok) {
          router.push("/apply/success");
        } else {
          setError(res?.error || "Something went wrong. Please try again.");
        }
      }}
      className="space-y-4"
    >
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>
      )}

      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">Parent / Guardian</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input name="parentName" className="input" required placeholder="Your full name" />
          </Field>
          <Field label="Phone">
            <input name="parentPhone" className="input" required placeholder="Mobile number" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Email address">
            <input name="parentEmail" type="email" className="input" required placeholder="you@example.com" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-400">Student</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Student name">
            <input name="studentName" className="input" required placeholder="Child's full name" />
          </Field>
          <Field label="Gender">
            <select name="studentGender" className="input" defaultValue="">
              <option value="">— Select —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input name="studentDob" type="date" className="input" />
          </Field>
          <Field label="Class / Grade">
            <input name="className" className="input" placeholder="e.g. Grade 8" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="School / Institution">
            <input name="institutionName" className="input" placeholder="Current school name" />
          </Field>
        </div>
      </div>

      <Field label="Message (optional)">
        <textarea name="message" className="input" rows={3} placeholder="Tell us a little about your child or any questions you have…" />
      </Field>

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
        </>
      ) : (
        <>
          Submit application <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
