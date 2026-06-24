"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Bell, Search } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";

export function Topbar({
  user,
  notifCount = 0,
  notifications = [],
  onMenu,
}: {
  user: { name: string; email: string; avatar?: string | null };
  notifCount?: number;
  notifications?: { id: string; title: string; message: string; link?: string | null }[];
  onMenu: () => void;
}) {
  const [openBell, setOpenBell] = useState(false);
  const today = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
      <button className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-6 w-6 text-slate-600" />
      </button>

      <div className="relative hidden flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input max-w-md pl-9" placeholder="Search anything..." />
      </div>
      <div className="flex-1 md:hidden" />

      <span className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 sm:inline">
        {today}
      </span>

      <div className="relative">
        <button
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          onClick={() => setOpenBell((v) => !v)}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {notifCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </button>
        {openBell && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpenBell(false)} />
            <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardhover">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy">
                Notifications
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">You're all caught up.</p>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.link || "#"}
                      className="block border-b border-slate-50 px-4 py-3 hover:bg-slate-50"
                      onClick={() => setOpenBell(false)}
                    >
                      <p className="text-sm font-medium text-slate-700">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Avatar name={user.name} src={user.avatar} size={36} />
      </div>
    </header>
  );
}
