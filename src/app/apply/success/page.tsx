import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function ApplySuccessPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-navy p-6 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(900px 500px at 80% -10%, rgba(47,168,79,.55), transparent), radial-gradient(700px 500px at 10% 110%, rgba(20,161,168,.5), transparent)",
        }}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-cardhover">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mt-8 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf-50">
            <CheckCircle2 className="h-9 w-9 text-leaf" />
          </span>
        </div>

        <h1 className="mt-5 text-2xl font-extrabold text-navy">Application Received</h1>
        <p className="mt-2 text-slate-500">
          Thank you for applying to the Student Leadership Empowerment Program.
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Our team will review your application and contact you soon with the next steps.
        </p>

        <Link href="/login" className="btn-primary mx-auto mt-8 w-full justify-center sm:w-auto">
          Go to sign in <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-6 text-xs text-slate-400">
          An Initiative of NDHR Global Solutions
        </p>
      </div>
    </div>
  );
}
