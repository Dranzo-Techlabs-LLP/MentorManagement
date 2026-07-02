import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MentorApplyForm } from "./MentorApplyForm";

export default function ApplyMentorPage() {
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
            SHAPE THE
            <br />
            <span className="text-leaf">NEXT GENERATION</span>
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Join our mentor resource pool. Guide students online or offline, share your experience, and
            help build tomorrow&apos;s leaders — from anywhere in the world.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/80">
            {["Online or Offline", "Flexible Schedule", "Global Reach", "Make an Impact"].map((t) => (
              <span key={t} className="rounded-full border border-white/20 bg-white/5 px-3 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-sm italic text-white/60">
          "A mentor empowers a person to see a <span className="font-semibold text-leaf">possible future</span>."
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-xl py-8">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-extrabold text-navy">Become a Mentor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Submit your CV and details below. Approved mentors join our resource pool after an interview.
          </p>

          <div className="mt-6">
            <MentorApplyForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-navy hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
