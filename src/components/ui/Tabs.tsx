"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function TabLinks({
  tabs,
  param = "tab",
}: {
  tabs: { key: string; label: string }[];
  param?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get(param) ?? tabs[0].key;
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => {
        const next = new URLSearchParams(Array.from(params.entries()));
        next.set(param, t.key);
        const isActive = active === t.key;
        return (
          <Link
            key={t.key}
            href={`${pathname}?${next.toString()}`}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition",
              isActive ? "border-navy text-navy" : "border-transparent text-slate-500 hover:text-slate-700",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
