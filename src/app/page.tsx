"use client";

import { useEffect } from "react";
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
  const { user, authLoading, setAuthLoading, view } = useAppStore();

  // Initial session check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const data = res.ok ? await res.json() : null;
        if (!cancelled) useAppStore.getState().setUser(data?.user ?? null);
      } catch {
        /* offline */
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600/25 border-t-teal-700" />
          <p className="text-sm text-muted-foreground">Memuat didikpme...</p>
        </div>
      </div>
    );
  }

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
