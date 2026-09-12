"use client";

import { useState, useEffect } from "react";
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
import { KopSuratView } from "@/components/views/kop-surat-view";

export default function Home() {
  const { user, view, viewAsTenantId } = useAppStore();
  const [visited, setVisited] = useState<Set<string>>(new Set(["dashboard"]));

  useEffect(() => {
    if (view && view !== "session-detail") {
      setVisited((prev) => {
        if (prev.has(view)) return prev;
        const next = new Set(prev);
        next.add(view);
        return next;
      });
    }
  }, [view]);

  // When switching tenant, reset visited views so only the active view mounts and fetches fresh data
  useEffect(() => {
    setVisited(new Set([view !== "session-detail" ? view : "dashboard"]));
  }, [viewAsTenantId]);

  // Setiap membuka aplikasi, wajib menampilkan form login terlebih dahulu
  if (!user) return <LoginView />;

  return (
    <AppShell>
      <div key={viewAsTenantId || "ALL"} className="min-w-0 flex-1">
        {visited.has("dashboard") && (
          <div className={view === "dashboard" ? "block" : "hidden"}>
            <DashboardView />
          </div>
        )}
        {visited.has("sessions") && (
          <div className={view === "sessions" ? "block" : "hidden"}>
            <SessionsView />
          </div>
        )}
        {view === "session-detail" && <SessionDetailView />}
        {visited.has("reports") && (
          <div className={view === "reports" ? "block" : "hidden"}>
            <ReportsView />
          </div>
        )}
        {visited.has("review") && (
          <div className={view === "review" ? "block" : "hidden"}>
            <ReviewView />
          </div>
        )}
        {visited.has("capa") && (
          <div className={view === "capa" ? "block" : "hidden"}>
            <CapaView />
          </div>
        )}
        {visited.has("kop-surat") && (
          <div className={view === "kop-surat" ? "block" : "hidden"}>
            <KopSuratView />
          </div>
        )}
        {visited.has("settings") && (
          <div className={view === "settings" ? "block" : "hidden"}>
            <SettingsView />
          </div>
        )}
        {visited.has("audit") && (
          <div className={view === "audit" ? "block" : "hidden"}>
            <AuditView />
          </div>
        )}
        {visited.has("users") && (
          <div className={view === "users" ? "block" : "hidden"}>
            <UsersView />
          </div>
        )}
      </div>
    </AppShell>
  );
}
