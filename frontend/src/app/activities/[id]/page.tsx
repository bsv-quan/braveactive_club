import ActivityDetailPage from "@/components/club/activity-detail-page";

type ActivityPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { id } = await params;
  return <ActivityDetailPage activityId={id} />;
}
