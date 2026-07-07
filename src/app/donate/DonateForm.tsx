"use client";

import { useState } from "react";
import { HeartHandshake, ArrowRight, Copy, Check } from "lucide-react";
import { Field } from "@/components/ui/form";

const PRESETS = [500, 1000, 2500, 5000];

export function DonateForm({
  donorName,
  donorEmail,
  paymentUrl,
  upiId,
}: {
  donorName: string;
  donorEmail: string;
  paymentUrl: string;
  upiId: string;
}) {
  const [preset, setPreset] = useState<number | "custom">(1000);
  const [custom, setCustom] = useState("");
  const [frequency, setFrequency] = useState<"once" | "monthly">("once");
  const [name, setName] = useState(donorName);
  const [email, setEmail] = useState(donorEmail);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  const amount = preset === "custom" ? Math.max(0, Math.floor(Number(custom) || 0)) : preset;
  const valid = amount > 0;

  function proceed() {
    if (!valid) return;
    if (paymentUrl) {
      // Hand off to the configured payment provider (Razorpay/Stripe/UPI link, etc.)
      const sep = paymentUrl.includes("?") ? "&" : "?";
      const qs = new URLSearchParams({
        amount: String(amount),
        frequency,
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      }).toString();
      window.location.href = `${paymentUrl}${sep}${qs}`;
    } else {
      // No gateway configured yet — show manual payment instructions.
      setShowInstructions(true);
    }
  }

  function copyUpi() {
    navigator.clipboard?.writeText(upiId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-5">
      {/* Amount */}
      <div>
        <label className="label">Choose an amount (₹)</label>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPreset(p); setCustom(""); }}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                preset === p
                  ? "border-gold bg-amber-50 text-amber-700"
                  : "border-slate-200 text-slate-600 hover:border-gold"
              }`}
            >
              ₹{p.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setPreset("custom"); }}
            className="input"
            placeholder="Or enter a custom amount"
          />
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="label">Frequency</label>
        <div className="mt-1 flex gap-2">
          {(["once", "monthly"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition ${
                frequency === f
                  ? "border-navy bg-navy-50 text-navy"
                  : "border-slate-200 text-slate-600 hover:border-navy"
              }`}
            >
              {f === "once" ? "One-time" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <button
        type="button"
        onClick={proceed}
        disabled={!valid}
        className="btn-gold w-full justify-center py-3 text-base disabled:cursor-not-allowed disabled:opacity-50"
      >
        <HeartHandshake className="h-5 w-5" />
        Proceed to Pay {valid ? `₹${amount.toLocaleString("en-IN")}` : ""}
        <ArrowRight className="h-5 w-5" />
      </button>

      {showInstructions && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
          <p className="font-bold text-amber-800">Complete your ₹{amount.toLocaleString("en-IN")} donation</p>
          {upiId ? (
            <div className="mt-2">
              <p>Pay via UPI to:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-white px-2 py-1 font-semibold text-navy">{upiId}</code>
                <button type="button" onClick={copyUpi} className="btn-ghost text-xs">
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2">
              Online payment isn&apos;t connected yet. Please contact the program office to complete your
              contribution, or ask an administrator to configure the payment gateway.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
