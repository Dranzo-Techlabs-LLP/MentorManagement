"use client";

import { useState } from "react";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { NavItem } from "@/lib/rbac";

export function Shell({
  nav,
  user,
  roleLabel,
  accent,
  notifCount,
  notifications,
  searchHref,
  children,
}: {
  nav: NavItem[];
  user: { name: string; email: string; avatar?: string | null; org?: string };
  roleLabel: string;
  accent: string;
  notifCount: number;
  notifications: { id: string; title: string; message: string; link?: string | null }[];
  searchHref?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar
        nav={nav}
        user={user}
        roleLabel={roleLabel}
        accent={accent}
        open={open}
        onClose={() => setOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} notifCount={notifCount} notifications={notifications} searchHref={searchHref} onMenu={() => setOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {/* Floating donate button — visible on every authenticated page */}
      <Link
        href="/donate"
        aria-label="Donate Us"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-bold text-white shadow-lg shadow-gold/40 transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-gold/30"
      >
        <HeartHandshake className="h-5 w-5" />
        <span className="hidden sm:inline">Donate Us</span>
      </Link>
    </div>
  );
}
