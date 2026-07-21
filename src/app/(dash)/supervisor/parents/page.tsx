import { ParentsView } from "@/components/pages/ParentsView";

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  return <ParentsView basePath="/supervisor/parents" page={Math.max(1, Number(page) || 1)} q={q} />;
}
