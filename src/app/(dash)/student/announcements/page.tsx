import { AnnouncementsView } from "@/components/pages/AnnouncementsView";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <AnnouncementsView basePath="/student/announcements" page={Math.max(1, Number(page) || 1)} />;
}
