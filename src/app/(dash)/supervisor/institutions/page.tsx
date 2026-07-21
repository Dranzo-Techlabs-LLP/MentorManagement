import { InstitutionsView } from "@/components/pages/InstitutionsView";

export default async function SupervisorInstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <InstitutionsView basePath="/supervisor/institutions" page={Math.max(1, Number(page) || 1)} />;
}
