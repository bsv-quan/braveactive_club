import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AppShell } from "@/components/layout/app-shell";

export default function Admin() {
  return (
    <AppShell currentPage="admin">
      <Suspense fallback={null}>
        <AdminPage />
      </Suspense>
    </AppShell>
  );
}
