import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="euG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E50A2" />
          <stop offset="55%" stopColor="#14A1A8" />
          <stop offset="100%" stopColor="#2FA84F" />
        </linearGradient>
      </defs>
      {/* U swoosh */}
      <path
        d="M14 12 V34 C14 46 23 53 33 53 C45 53 52 44 52 32 V20"
        stroke="url(#euG)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* leaping figure stem */}
      <path
        d="M30 50 C30 38 33 28 44 18"
        stroke="#2FA84F"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* figure head */}
      <circle cx="46" cy="15" r="4.6" fill="#1E50A2" />
      {/* star */}
      <path
        d="M50 6 l1.4 3 3.3.4 -2.4 2.3 .6 3.3 -2.9 -1.6 -2.9 1.6 .6 -3.3 -2.4 -2.3 3.3 -.4z"
        fill="#E0A92E"
      />
      {/* book base */}
      <path d="M20 56 h24" stroke="#E0A92E" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  className,
  variant = "full",
  light = false,
}: {
  className?: string;
  variant?: "full" | "compact" | "mark";
  light?: boolean;
}) {
  if (variant === "mark") return <LogoMark className={className} />;
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <div className="leading-none">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-xl font-extrabold tracking-tight", light ? "text-white" : "text-navy")}>
            ELEVATE
          </span>
          <span className="text-xl font-extrabold tracking-tight text-leaf">U</span>
        </div>
        {variant === "full" && (
          <div className={cn("mt-0.5 text-[9px] font-semibold tracking-[0.18em]", light ? "text-white/70" : "text-slate-500")}>
            MENTOR · EMPOWER · EXCEL
          </div>
        )}
      </div>
    </div>
  );
}
