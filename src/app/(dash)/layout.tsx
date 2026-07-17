import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NAV, ROLE_LABEL, ROLE_THEME, SEARCH_TARGET } from "@/lib/rbac";
import { getPermsForUser } from "@/lib/permissions";
import { NAV_RESOURCE } from "@/lib/permission-data";
import { Shell } from "@/components/shell/Shell";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [notifications, notifCount, user] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      include: { institution: true },
    }),
  ]);

  if (!user) redirect("/login");

  // RBAC: hide sidebar sections the user's permission role cannot view.
  const eff = await getPermsForUser(session.userId);
  const nav = NAV[session.role].filter((item) => {
    const resource = NAV_RESOURCE[item.href];
    return !resource || eff.perms[resource].view;
  });

  return (
    <Shell
      nav={nav}
      user={{
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        org: user.institution?.name ?? "NDHR Global",
      }}
      roleLabel={ROLE_LABEL[session.role]}
      accent={ROLE_THEME[session.role]}
      searchHref={SEARCH_TARGET[session.role]}
      notifCount={notifCount}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        link: n.link,
      }))}
    >
      {children}
    </Shell>
  );
}
