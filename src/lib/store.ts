"use client";

import { create } from "zustand";
import type { UserInfo } from "@/types/pme";

export type AppView =
  | "dashboard"
  | "sessions"
  | "session-detail"
  | "reports"
  | "review"
  | "capa"
  | "kop-surat"
  | "settings"
  | "audit"
  | "users";

interface AppState {
  user: UserInfo | null;
  authLoading: boolean;
  view: AppView;
  activeSessionId: string | null;
  sidebarOpen: boolean;
  viewAsTenantId: string | null;
  logoutReason: string | null;
  setUser: (user: UserInfo | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setLogoutReason: (reason: string | null) => void;
  navigate: (view: AppView, sessionId?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setViewAsTenantId: (tenantId: string | null) => void;
  refreshUser: () => Promise<void>;
  logout: (reason?: string | null) => Promise<void>;
}

function getInitialTenantCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)didikpme_view_as_tenant=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authLoading: false,
  view: "dashboard",
  activeSessionId: null,
  sidebarOpen: false,
  viewAsTenantId: getInitialTenantCookie() || "ALL",
  logoutReason: null,
  setUser: (user) => set({ user }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setLogoutReason: (logoutReason) => set({ logoutReason }),
  navigate: (view, sessionId = null) =>
    set({ view, activeSessionId: sessionId, sidebarOpen: false }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setViewAsTenantId: (tenantId) => {
    const val = tenantId && tenantId.trim() ? tenantId.trim() : "ALL";
    if (typeof document !== "undefined") {
      document.cookie = `didikpme_view_as_tenant=${val}; path=/; max-age=86400; SameSite=Lax`;
    }
    const currentView = get().view;
    set({
      viewAsTenantId: val,
      activeSessionId: null,
      view: currentView === "session-detail" ? "sessions" : currentView,
    });
  },
  refreshUser: async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user });
      } else {
        set({ user: null });
      }
    } catch {
      set({ user: null });
    }
  },
  logout: async (reason = null) => {
    if (typeof document !== "undefined") {
      document.cookie = `didikpme_view_as_tenant=; path=/; max-age=0; SameSite=Lax`;
    }
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    set({
      user: null,
      view: "dashboard",
      activeSessionId: null,
      viewAsTenantId: "ALL",
      logoutReason: reason ?? null,
    });
  },
}));

export function isAdmin(): boolean {
  const role = useAppStore.getState().user?.role;
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function isSuperAdmin(): boolean {
  return useAppStore.getState().user?.role === "SUPERADMIN";
}
