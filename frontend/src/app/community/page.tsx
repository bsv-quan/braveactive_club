import { CommunityPage } from "@/components/community/community-page";
import { SharedPostPage } from "@/components/community/shared-post-page";
import { AppShell } from "@/components/layout/app-shell";

export default async function Community({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const { post } = await searchParams;
  return (
    <AppShell currentPage="community">
      {post ? <SharedPostPage postId={post} /> : <CommunityPage />}
    </AppShell>
  );
}
