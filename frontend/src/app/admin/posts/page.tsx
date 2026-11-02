import { AdminPostsPage } from "@/components/community/admin-posts-page";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminPosts() {
  return (
    <AppShell currentPage="admin">
      <AdminPostsPage />
    </AppShell>
  );
}
