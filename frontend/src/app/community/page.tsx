import { CommunityPage } from "@/components/community/community-page";
import { AppShell } from "@/components/layout/app-shell";

export default function Community() {
  return (
    <AppShell currentPage="community">
      <CommunityPage />
    </AppShell>
  );
}
