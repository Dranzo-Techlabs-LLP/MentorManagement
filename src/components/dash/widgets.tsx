import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <h3 className="font-bold text-navy">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function MiniMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function ActivityItem({
  title,
  meta,
  time,
  dot = "#1E50A2",
}: {
  title: string;
  meta?: string;
  time?: string;
  dot?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {meta && <p className="truncate text-xs text-slate-400">{meta}</p>}
      </div>
      {time && <span className="shrink-0 text-xs text-slate-400">{time}</span>}
    </div>
  );
}

export function QuickAction({
  href,
  label,
  tone = "navy",
}: {
  href: string;
  label: string;
  tone?: "navy" | "green" | "gold" | "outline";
}) {
  const cls =
    tone === "green"
      ? "btn-green"
      : tone === "gold"
        ? "btn-gold"
        : tone === "outline"
          ? "btn-outline"
          : "btn-primary";
  return (
    <Link href={href} className={cn(cls, "w-full")}>
      {label}
    </Link>
  );
}

export function AlertRow({
  text,
  href,
  tone = "amber",
}: {
  text: string;
  href?: string;
  tone?: "amber" | "red" | "blue";
}) {
  const color =
    tone === "red" ? "bg-red-50 text-red-600" : tone === "blue" ? "bg-navy-50 text-navy-700" : "bg-amber-50 text-amber-700";
  const inner = (
    <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", color)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// build a gently rising 6-month trend ending near `target`
export function trendSeries(target: number, months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]) {
  const start = Math.max(20, target - 28);
  return months.map((m, i) => ({
    name: m,
    value: Math.round(start + ((target - start) * i) / (months.length - 1)),
  }));
}
