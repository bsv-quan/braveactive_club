import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { AppShell } from "@/components/layout/app-shell";
import { safeNextPath } from "@/lib/safe-redirect";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AppShell>
      <ChangePasswordForm nextPath={safeNextPath(next)} />
    </AppShell>
  );
}
