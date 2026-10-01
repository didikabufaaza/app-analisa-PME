import type { AppView } from "@/lib/store";
import type { UserInfo } from "@/types/pme";

/**
 * Validates whether a specific view is permitted for the given user.
 * Superadmin has access to all views.
 * Other roles are strictly restricted to views explicitly granted in user.menuAccess,
 * or fall back to standard role defaults if menuAccess has never been configured.
 */
export function isViewAllowed(view: AppView, user: UserInfo | null): boolean {
  if (!user) return false;

  // Superadmin has absolute access to every view
  if (user.role === "SUPERADMIN") return true;

  // View 'users' is strictly for Superadmin
  if (view === "users") return false;

  // Check explicit menuAccess array if present
  if (Array.isArray(user.menuAccess)) {
    // PME Management sub-views
    if (view === "pme-registration" || view === "pme-packages" || view === "pme-input") {
      return user.menuAccess.includes("pme-management") || user.menuAccess.includes(view);
    }
    if (view === "pme-reports") {
      return user.menuAccess.includes("pme-reports") || user.menuAccess.includes("pme-management");
    }
    if (view === "pme-info" || view === "master-data") {
      // PME Info and Master Data are reserved for Superadmin, or ADMIN2 if given pme-management
      return user.role === "ADMIN2" && user.menuAccess.includes("pme-management");
    }
    if (view === "session-detail") {
      return user.menuAccess.includes("sessions");
    }

    // Direct match for standard views (dashboard, sessions, reports, review, capa, kop-surat, settings, audit)
    return user.menuAccess.includes(view);
  }

  // Fallback defaults for legacy unconfigured users without menuAccess
  const roleDefaults: Record<string, string[]> = {
    ADMIN2: ["dashboard", "sessions", "reports", "review", "capa", "kop-surat", "settings", "audit", "pme-management"],
    ADMIN: ["pme-management", "pme-reports"],
    SUPERVISOR: ["pme-management", "pme-reports"],
    ANALYST: ["pme-management", "pme-reports"],
  };

  const allowedKeys = roleDefaults[user.role] || ["pme-management", "pme-reports"];
  if (view === "pme-registration" || view === "pme-packages" || view === "pme-input" || view === "pme-reports") {
    return allowedKeys.includes("pme-management") || allowedKeys.includes(view);
  }
  if (view === "session-detail") {
    return allowedKeys.includes("sessions");
  }
  return allowedKeys.includes(view);
}

/**
 * Returns the first valid/allowed view for the given user to prevent landing on unauthorized views.
 */
export function getFirstAllowedView(user: UserInfo | null): AppView {
  if (!user) return "dashboard";
  if (user.role === "SUPERADMIN") return "dashboard";

  const candidates: AppView[] = [
    "dashboard",
    "pme-input",
    "pme-reports",
    "pme-packages",
    "pme-registration",
    "sessions",
    "reports",
    "review",
    "capa",
    "kop-surat",
    "settings",
    "audit",
  ];

  for (const candidate of candidates) {
    if (isViewAllowed(candidate, user)) {
      return candidate;
    }
  }

  return "pme-input";
}
