import { MentorApplicationsView } from "@/components/pages/MentorApplicationsView";

export default async function MentorApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page } = await searchParams;
  return <MentorApplicationsView basePath="/supervisor/mentor-applications" page={Math.max(1, Number(page) || 1)} tab={tab} />;
}
