"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/primitives";
import { ICONS } from "./icon-map";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/rbac";

export function Sidebar({
  nav,
  user,
  roleLabel,
  accent,
  open,
  onClose,
}: {
  nav: NavItem[];
  user: { name: string; email: string; avatar?: string | null; org?: string };
  roleLabel: string;
  accent: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Logo light variant="compact" />
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5 text-white/70" />
          </button>
        </div>

        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
          <Avatar name={user.name} src={user.avatar} size={38} tint={accent} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-white/60">{roleLabel}{user.org ? ` · ${user.org}` : ""}</p>
          </div>
        </div>

        <nav className="thin-scroll flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {nav.map((item) => {
            const Icon = ICONS[item.icon] ?? ICONS.LayoutDashboard;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/logout" method="post" className="border-t border-white/10 p-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-[18px] w-[18px]" /> Logout
          </button>
        </form>
      </aside>
    </>
  );
}
