import { ApplicationsView } from "@/components/pages/ApplicationsView";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page } = await searchParams;
  return <ApplicationsView basePath="/chief/applications" page={Math.max(1, Number(page) || 1)} tab={tab} />;
}
