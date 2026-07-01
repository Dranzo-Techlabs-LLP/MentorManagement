"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const DEMO = [
  { label: "Super Admin", email: "superadmin@ndhrglobal.com" },
  { label: "Chief Mentor", email: "chief@ndhrglobal.com" },
  { label: "Supervisor", email: "supervisor@ndhrglobal.com" },
  { label: "Mentor", email: "mentor@ndhrglobal.com" },
  { label: "Parent", email: "parent@ndhrglobal.com" },
  { label: "Student", email: "student@ndhrglobal.com" },
];
const DEMO_PASS = "Elevate@123";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Login failed");
      setLoading(false);
      return;
    }
    router.push(params.get("next") || data.home);
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(900px 500px at 80% -10%, rgba(47,168,79,.55), transparent), radial-gradient(700px 500px at 10% 110%, rgba(20,161,168,.5), transparent)",
          }}
        />
        <div className="relative">
          <Logo light />
          <p className="mt-1 text-xs font-medium text-white/60">An Initiative of NDHR Global Solutions</p>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">
            MENTORING TODAY,
            <br />
            <span className="text-leaf">LEADING TOMORROW</span>
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Guiding young minds. Building strong leaders. The Mentoring Management Portal for the
            Student Leadership Empowerment Program.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/80">
            {["Personalized Mentoring", "Track Progress", "Assess & Analyze", "Parent Partnership"].map((t) => (
              <span key={t} className="rounded-full border border-white/20 bg-white/5 px-3 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-sm italic text-white/60">
          "The best way to predict your future is to <span className="font-semibold text-leaf">create it</span>."
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-extrabold text-navy">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to the Elevate U mentoring portal.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@ndhrglobal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="mt-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Demo logins (password: {DEMO_PASS})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(DEMO_PASS);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-navy hover:bg-navy-50"
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Parent enquiry?{" "}
              <a href="/apply" className="font-semibold text-navy hover:underline">
                Submit an application
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginForm />
    </Suspense>
  );
}
