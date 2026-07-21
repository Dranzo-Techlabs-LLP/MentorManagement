import { SessionsView } from "@/components/pages/SessionsView";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page } = await searchParams;
  return <SessionsView basePath="/chief/sessions" page={Math.max(1, Number(page) || 1)} tab={tab} />;
}
