"use client";

import { useState } from "react";
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
    </div>
  );
}
