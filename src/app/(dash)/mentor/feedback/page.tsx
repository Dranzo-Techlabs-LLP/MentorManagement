import { FeedbackView } from "@/components/pages/FeedbackView";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <FeedbackView basePath="/mentor/feedback" page={Math.max(1, Number(page) || 1)} />;
}
