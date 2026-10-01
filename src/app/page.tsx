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
import { PmeRegistrationView } from "@/components/views/pme-registration-view";
import { PmePackagesView } from "@/components/views/pme-packages-view";
import { PmeInputView } from "@/components/views/pme-input-view";
import { PmeReportsView } from "@/components/views/pme-reports-view";
import { PmeInfoView } from "@/components/views/pme-info-view";
import { MasterDataView } from "@/components/views/master-data-view";
import { isViewAllowed, getFirstAllowedView } from "@/lib/permissions";

export default function Home() {
  const { user, view, navigate, viewAsTenantId } = useAppStore();
  const [visited, setVisited] = useState<Set<string>>(new Set());

  // Reset visited and ensure view is valid whenever user logs in or switches
  useEffect(() => {
    if (!user) {
      setVisited(new Set());
      return;
    }
    const safeView = isViewAllowed(view, user) ? view : getFirstAllowedView(user);
    if (safeView !== view) {
      navigate(safeView);
    }
    setVisited(new Set([safeView]));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (view && view !== "session-detail") {
      if (!isViewAllowed(view, user)) {
        navigate(getFirstAllowedView(user));
        return;
      }
      setVisited((prev) => {
        if (prev.has(view)) return prev;
        const next = new Set(prev);
        next.add(view);
        return next;
      });
    }
  }, [view, user]);

  // When switching tenant, reset visited views so only the active view mounts and fetches fresh data
  useEffect(() => {
    if (!user) return;
    const safeView = isViewAllowed(view, user) ? view : getFirstAllowedView(user);
    setVisited(new Set([safeView]));
  }, [viewAsTenantId]);

  // Setiap membuka aplikasi, wajib menampilkan form login terlebih dahulu
  if (!user) return <LoginView />;

  return (
    <AppShell>
      <div key={`${user.id}-${viewAsTenantId || "ALL"}`} className="min-w-0 flex-1">
        {visited.has("dashboard") && isViewAllowed("dashboard", user) && (
          <div className={view === "dashboard" ? "block" : "hidden"}>
            <DashboardView />
          </div>
        )}
        {visited.has("sessions") && isViewAllowed("sessions", user) && (
          <div className={view === "sessions" ? "block" : "hidden"}>
            <SessionsView />
          </div>
        )}
        {view === "session-detail" && isViewAllowed("session-detail", user) && <SessionDetailView />}
        {visited.has("reports") && isViewAllowed("reports", user) && (
          <div className={view === "reports" ? "block" : "hidden"}>
            <ReportsView />
          </div>
        )}
        {visited.has("review") && isViewAllowed("review", user) && (
          <div className={view === "review" ? "block" : "hidden"}>
            <ReviewView />
          </div>
        )}
        {visited.has("capa") && isViewAllowed("capa", user) && (
          <div className={view === "capa" ? "block" : "hidden"}>
            <CapaView />
          </div>
        )}
        {visited.has("kop-surat") && isViewAllowed("kop-surat", user) && (
          <div className={view === "kop-surat" ? "block" : "hidden"}>
            <KopSuratView />
          </div>
        )}
        {visited.has("settings") && isViewAllowed("settings", user) && (
          <div className={view === "settings" ? "block" : "hidden"}>
            <SettingsView />
          </div>
        )}
        {visited.has("audit") && isViewAllowed("audit", user) && (
          <div className={view === "audit" ? "block" : "hidden"}>
            <AuditView />
          </div>
        )}
        {visited.has("users") && isViewAllowed("users", user) && (
          <div className={view === "users" ? "block" : "hidden"}>
            <UsersView />
          </div>
        )}
        {visited.has("pme-registration") && isViewAllowed("pme-registration", user) && (
          <div className={view === "pme-registration" ? "block" : "hidden"}>
            <PmeRegistrationView />
          </div>
        )}
        {visited.has("pme-packages") && isViewAllowed("pme-packages", user) && (
          <div className={view === "pme-packages" ? "block" : "hidden"}>
            <PmePackagesView />
          </div>
        )}
        {visited.has("pme-input") && isViewAllowed("pme-input", user) && (
          <div className={view === "pme-input" ? "block" : "hidden"}>
            <PmeInputView />
          </div>
        )}
        {visited.has("pme-reports") && isViewAllowed("pme-reports", user) && (
          <div className={view === "pme-reports" ? "block" : "hidden"}>
            <PmeReportsView />
          </div>
        )}
        {visited.has("pme-info") && isViewAllowed("pme-info", user) && (
          <div className={view === "pme-info" ? "block" : "hidden"}>
            <PmeInfoView />
          </div>
        )}
        {visited.has("master-data") && isViewAllowed("master-data", user) && (
          <div className={view === "master-data" ? "block" : "hidden"}>
            <MasterDataView />
          </div>
        )}
      </div>
    </AppShell>
  );
}
