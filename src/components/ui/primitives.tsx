import { cn, initials } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div>
        <h3 className="font-bold text-navy">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  tint = "#1E50A2",
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  icon?: React.ReactNode;
  tint?: string;
}) {
  return (
    <div className="stat-card">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
        {delta && <p className="mt-1 text-xs font-semibold text-leaf-600">{delta}</p>}
      </div>
      {icon && (
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: `${tint}1a`, color: tint }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  green: "bg-leaf-50 text-leaf-700",
  blue: "bg-navy-50 text-navy-700",
  gold: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
  purple: "bg-violet-50 text-violet-700",
  teal: "bg-teal-50 text-teal-700",
};

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return <span className={cn("badge", BADGE_TONES[tone], className)}>{children}</span>;
}

export function Progress({ value, color = "#2FA84F" }: { value: number; color?: string }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 40,
  tint = "#1E50A2",
}: {
  name: string;
  src?: string | null;
  size?: number;
  tint?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: tint, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-600">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-400">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
