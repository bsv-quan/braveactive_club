import { SharedPostPage } from "@/components/community/shared-post-page";
import { AppShell } from "@/components/layout/app-shell";

export default async function SharedCommunityPost({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell currentPage="community">
      <SharedPostPage postId={id} />
    </AppShell>
  );
}
