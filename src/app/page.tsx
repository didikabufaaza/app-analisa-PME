"use client";

import { useAppStore } from "@/lib/store";
import { LoginView } from "@/components/app/login-view";
import { AppShell } from "@/components/app/app-shell";
import { DashboardView } from "@/components/views/dashboard-view";
import { SessionsView } from "@/components/views/sessions-view";
import { SessionDetailView } from "@/components/views/session-detail-view";
import { ReportsView } from "@/components/views/reports-view";
import { ReviewView } from "@/components/views/review-view";
import { CapaView } from "@/components/views/capa-view";
import { SettingsView } from "@/components/views/settings-view";
import { AuditView } from "@/components/views/audit-view";
import { UsersView } from "@/components/views/users-view";

export default function Home() {
  const { user, view } = useAppStore();

  // Setiap membuka aplikasi, wajib menampilkan form login terlebih dahulu
  if (!user) return <LoginView />;

  return (
    <AppShell>
      {view === "dashboard" && <DashboardView />}
      {view === "sessions" && <SessionsView />}
      {view === "session-detail" && <SessionDetailView />}
      {view === "reports" && <ReportsView />}
      {view === "review" && <ReviewView />}
      {view === "capa" && <CapaView />}
      {view === "settings" && <SettingsView />}
      {view === "audit" && <AuditView />}
      {view === "users" && <UsersView />}
    </AppShell>
  );
}
