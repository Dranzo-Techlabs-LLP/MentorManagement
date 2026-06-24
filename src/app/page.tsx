import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/rbac";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(ROLE_HOME[session.role]);
  redirect("/login");
}
