"use client";

import { create } from "zustand";
import type { UserInfo } from "@/types/pme";
import type { Language } from "@/lib/i18n";

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
  | "users"
  | "pme-registration"
  | "pme-packages"
  | "pme-input"
  | "pme-reports"
  | "pme-info"
  | "master-data";

export interface SidebarTheme {
  bgColor: string;          // e.g. "#0B131B"
  fontSize: string;         // e.g. "14.5px"
  fontWeight: string;       // e.g. "600"
  textColor: string;        // e.g. "#94A3B8"
  activeTextColor: string;  // e.g. "#2DD4BF"
  activeBgColor: string;    // e.g. "rgba(20, 184, 166, 0.22)"
}

export const DEFAULT_SIDEBAR_THEME: SidebarTheme = {
  bgColor: "#0B131B",
  fontSize: "14.5px",
  fontWeight: "600",
  textColor: "#94A3B8",
  activeTextColor: "#2DD4BF",
  activeBgColor: "rgba(20, 184, 166, 0.22)",
};

function getInitialSidebarTheme(): SidebarTheme {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_THEME;
  try {
    const raw = localStorage.getItem("smartpme_sidebar_theme");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SIDEBAR_THEME, ...parsed };
    }
  } catch {}
  return DEFAULT_SIDEBAR_THEME;
}

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "id";
  try {
    const raw = localStorage.getItem("smartpme_lang");
    if (raw === "en" || raw === "id") return raw;
  } catch {}
  return "id";
}

interface AppState {
  user: UserInfo | null;
  authLoading: boolean;
  view: AppView;
  activeSessionId: string | null;
  sidebarOpen: boolean;
  viewAsTenantId: string | null;
  logoutReason: string | null;
  sidebarTheme: SidebarTheme;
  language: Language;
  setUser: (user: UserInfo | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setLogoutReason: (reason: string | null) => void;
  navigate: (view: AppView, sessionId?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setViewAsTenantId: (tenantId: string | null) => void;
  setSidebarTheme: (theme: Partial<SidebarTheme>) => void;
  resetSidebarTheme: () => void;
  setLanguage: (lang: Language) => void;
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
  sidebarTheme: getInitialSidebarTheme(),
  language: getInitialLanguage(),
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
  setSidebarTheme: (updated) => {
    const next = { ...get().sidebarTheme, ...updated };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("smartpme_sidebar_theme", JSON.stringify(next));
      } catch {}
    }
    set({ sidebarTheme: next });
  },
  resetSidebarTheme: () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("smartpme_sidebar_theme");
      } catch {}
    }
    set({ sidebarTheme: DEFAULT_SIDEBAR_THEME });
  },
  setLanguage: (language) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("smartpme_lang", language);
      } catch {}
    }
    set({ language });
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
    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
        document.cookie = `didikpme_view_as_tenant=; path=/; max-age=0; SameSite=Lax`;
      } catch {}
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
