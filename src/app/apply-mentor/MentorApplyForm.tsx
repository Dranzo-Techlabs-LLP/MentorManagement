"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { submitMentorApplication } from "@/lib/actions";
import { Field } from "@/components/ui/form";

/** Public "become a mentor" application. Submits via server action; shows inline success. */
export function MentorApplyForm() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-xl border border-leaf/30 bg-leaf-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-leaf" />
        <h3 className="mt-3 text-lg font-bold text-navy">Application received</h3>
        <p className="mt-1 text-sm text-slate-600">
          Thank you for applying. Our team will review your profile and reach out to schedule an interview.
        </p>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        setError("");
        const res = await submitMentorApplication(fd);
        if (res?.ok) setDone(true);
        else setError(res?.error || "Something went wrong. Please try again.");
      }}
      className="space-y-4"
    >
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="name" className="input" required placeholder="Your full name" />
        </Field>
        <Field label="Email address">
          <input name="email" type="email" className="input" required placeholder="you@example.com" />
        </Field>
        <Field label="Phone">
          <input name="phone" className="input" placeholder="Mobile number" />
        </Field>
        <Field label="City">
          <input name="city" className="input" placeholder="Kochi" />
        </Field>
        <Field label="Preferred mode">
          <select name="preferredMode" className="input" defaultValue="">
            <option value="">— Select —</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="BOTH">Both</option>
          </select>
        </Field>
        <Field label="Languages">
          <input name="languages" className="input" placeholder="English, Malayalam, Hindi" />
        </Field>
        <Field label="Time zone">
          <input name="timezone" className="input" placeholder="GMT+5:30" />
        </Field>
        <Field label="Exposure">
          <input name="exposure" className="input" placeholder="International / European exposure" />
        </Field>
      </div>

      <Field label="Qualifications">
        <textarea name="qualifications" className="input" rows={2} placeholder="Degrees, certifications…" />
      </Field>
      <Field label="Experience">
        <textarea name="experience" className="input" rows={2} placeholder="Relevant mentoring / teaching experience…" />
      </Field>
      <Field label="CV / Profile summary" hint="Type your CV or a short professional summary.">
        <textarea name="cv" className="input" rows={5} placeholder="Paste or type your CV here…" />
      </Field>
      <Field label="…or upload a CV file" hint="PDF or DOC, up to 10MB.">
        <input type="file" name="cvFile" className="input" accept=".pdf,.doc,.docx" />
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
        <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
      ) : (
        <>Submit application <ArrowRight className="h-4 w-4" /></>
      )}
    </button>
  );
}
