import { LoginForm } from "@/components/auth/login-form";
import { AppShell } from "@/components/layout/app-shell";
import { safeNextPath } from "@/lib/safe-redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AppShell>
      <LoginForm nextPath={safeNextPath(next)} />
    </AppShell>
  );
}
