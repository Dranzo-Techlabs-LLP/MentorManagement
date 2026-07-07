import Link from "next/link";
import { ArrowLeft, HeartHandshake, GraduationCap, Users, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";
import { Logo } from "@/components/brand/Logo";
import { DonateForm } from "./DonateForm";

export default async function DonatePage() {
  // Public page — a session is optional and only used to prefill donor details.
  const sess = await getSession();
  const paymentUrl = process.env.DONATION_PAYMENT_URL ?? "";
  const upiId = process.env.DONATION_UPI_ID ?? "";
  const backHref = sess ? ROLE_HOME[sess.role] : "/login";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-8">
        <Logo />
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> {sess ? "Back to dashboard" : "Back to sign in"}
        </Link>
      </header>

      <main className="mx-auto max-w-4xl p-4 lg:p-8">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-navy">Support Our Mission</h1>
          <p className="mt-1 text-sm text-slate-500">
            Help us mentor the next generation of student leaders under SLEP
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          {/* Impact panel */}
          <div className="lg:col-span-2">
            <div className="card h-full overflow-hidden">
              <div className="bg-navy p-6 text-white">
                <HeartHandshake className="h-9 w-9 text-leaf" />
                <h3 className="mt-3 text-xl font-extrabold">Every contribution counts</h3>
                <p className="mt-2 text-sm text-white/70">
                  Your donation funds mentoring sessions, assessments and growth resources for students in the
                  Student Leadership Empowerment Program.
                </p>
              </div>
              <div className="space-y-4 p-6">
                <Impact icon={<GraduationCap className="h-5 w-5" />} title="Mentorship" text="Sponsor one-on-one mentoring for a student." />
                <Impact icon={<Users className="h-5 w-5" />} title="Reach" text="Extend the program to more schools and families." />
                <Impact icon={<ShieldCheck className="h-5 w-5" />} title="Secure" text="Payments are handled by trusted providers." />
              </div>
            </div>
          </div>

          {/* Payment panel */}
          <div className="lg:col-span-3">
            <div className="card p-6">
              <h3 className="text-lg font-extrabold text-navy">Make a donation</h3>
              <p className="mt-1 text-sm text-slate-500">Choose an amount and proceed to secure payment.</p>
              <div className="mt-5">
                <DonateForm
                  donorName={sess?.name ?? ""}
                  donorEmail={sess?.email ?? ""}
                  paymentUrl={paymentUrl}
                  upiId={upiId}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Impact({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">{icon}</span>
      <div>
        <p className="text-sm font-bold text-navy">{title}</p>
        <p className="text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}
