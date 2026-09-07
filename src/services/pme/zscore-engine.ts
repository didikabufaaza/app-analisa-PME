/**
 * Z-Score Rule Engine (PRD section #24)
 *
 * DETERMINISTIC: the backend — never the AI — decides the final status.
 * Rules are configurable per organization with versioning.
 *
 *   ABS(z) <= satisfactoryLimit        -> SATISFACTORY
 *   satisfactoryLimit < ABS(z) < warn  -> WARNING
 *   ABS(z) >= warningLimit             -> UNSATISFACTORY
 */
import { db } from "@/lib/db";

export interface ZRule {
  ruleVersion: string;
  satisfactoryLimit: number;
  warningLimit: number;
}

export async function getActiveRule(organizationId: string): Promise<ZRule> {
  const rule = await db.zscoreRule.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { effectiveDate: "desc" },
  });
  if (rule) {
    return {
      ruleVersion: rule.ruleVersion,
      satisfactoryLimit: rule.satisfactoryLimit,
      warningLimit: rule.warningLimit,
    };
  }
  // Built-in fallback per PRD defaults (also persisted on demand)
  return { ruleVersion: "v1.0-default", satisfactoryLimit: 2, warningLimit: 3 };
}

export type ZStatus = "SATISFACTORY" | "WARNING" | "UNSATISFACTORY";

export function computeZStatus(zScore: number | null | undefined, rule: ZRule): ZStatus | null {
  if (zScore === null || zScore === undefined || !Number.isFinite(zScore)) return null;
  const az = Math.abs(zScore);
  if (az >= rule.warningLimit) return "UNSATISFACTORY";
  if (az > rule.satisfactoryLimit) return "WARNING";
  return "SATISFACTORY";
}
