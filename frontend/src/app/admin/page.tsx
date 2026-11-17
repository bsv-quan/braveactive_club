import { AdminPage } from "@/components/admin/admin-page";
import { AppShell } from "@/components/layout/app-shell";

export default function Admin() {
  return <AppShell currentPage="admin"><AdminPage /></AppShell>;
}
