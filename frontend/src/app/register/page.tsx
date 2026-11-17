import { RegisterForm } from "@/components/auth/register-form";
import { AppShell } from "@/components/layout/app-shell";
import { safeNextPath } from "@/lib/safe-redirect";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AppShell>
      <RegisterForm nextPath={safeNextPath(next)} />
    </AppShell>
  );
}
