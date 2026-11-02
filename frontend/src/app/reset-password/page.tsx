import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AppShell } from "@/components/layout/app-shell";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AppShell>
      <ResetPasswordForm token={token ?? ""} />
    </AppShell>
  );
}
