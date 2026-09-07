# Task 6-c — Frontend Views (review / capa / settings / audit)

Agent: frontend-views-6c
Date: session of Task 6-c
Files owned (all replaced placeholders, all `"use client"`):
- src/components/views/review-view.tsx
- src/components/views/capa-view.tsx
- src/components/views/settings-view.tsx
- src/components/views/audit-view.tsx

## Work Record
1. Read worklog.md API contract + shared files (api-client.ts, store.ts, types/pme.ts, hooks/use-toast.ts). No shared file modified.
2. Verified live backend behavior before coding:
   - GET /api/review `categorize()` returns exactly: "Low Confidence" | "Missing Data" | "OCR Conflict" | "Extraction Conflict" | "Possible Numeric Error" (chips match these keys; `categories` is a single primary category string).
   - PATCH /api/pme/results/:id: backend `num()` turns non-numeric input into null, but `Number(null) === 0` — so the Edit dialog omits empty fields entirely (empty = unchanged) instead of sending them.
   - GET /api/ai-usage: `summary.successfulRequests` is the quota "used" counter (backend sets `successfulRequests: used`); Progress caption uses it against `summary.limit`.
   - Confidence values are 0..1 (validation engine flags < 0.85). UI renders % and defensively rescales values > 1.
3. review-view.tsx (PRD #33): toggleable category chips with live counts from `categoryCounts`; item cards (parameter, session cycle/program, value tiles, zStatus badge id-ID, 8 issue-code -> Indonesian label badges, 4 confidence dots, source page + sourceText excerpt); Accept/Reject/Reprocess -> POST /api/pme/results/{id}/review (AlertDialog confirm for Reject/Reprocess; Reprocess toast "Sesi sedang direproses"); Edit dialog -> PATCH /api/pme/results/{id} then refetch; local list removal + count decrement after accept/reject/reprocess; CheckCircle2 empty state.
4. capa-view.tsx (PRD #29): status Select refetches `?status=`; create dialog (problem required) POST /api/capa; cards with status badges (OPEN amber / IN_PROGRESS teal / CLOSED emerald), "Parameter: X (Z=…)", overdue dueDate red (due < today 00:00 && status !== CLOSED), snippets; Detail dialog with all fields + status advance OPEN->IN_PROGRESS->CLOSED (AlertDialog confirm, PATCH {status}, plus reopen) + full Edit dialog (PATCH all fields).
5. settings-view.tsx: ADMIN = user?.role === "ADMIN" from useAppStore.
   - Aturan Z-Score (PRD #24): inputs prefilled from `active`, admin-only save PATCH {satisfactoryLimit,warningLimit,reapply:true} (validates positive + sat<=warn), toast shows ruleVersion + reevaluated count; non-admin read-only + note; history table (max-h-64 scroll).
   - Konfigurasi AI (PRD #46, ADMIN-only render; fetch failure 403/404 hides section silently): provider(+mode, internal fallback), model, API Status badge (Connected emerald / Error red) + apiStatusDetail Alert (destructive on error, amber otherwise), fallback status/detail, monospace masked key, last successful request, monthly requests, token in/out, est. cost USD.
   - Kuota & Penggunaan: alerts[] -> amber Alerts, Progress(usagePct) + used/limit caption, stat tiles (requests/errors/total tokens/est. cost), recentLogs table in max-h-72 scroll.
6. audit-view.tsx: client-side search over action/user/email/entity/details JSON; table in max-h-[36rem] overflow-y-auto sticky header; Waktu id-ID locale; action badge color map as specified; entityType + short entityId; details JSON truncated 80 chars with hover Tooltip (full, scrollable) + click-row expand.

## Verification
- `bun run lint` -> clean (no output).
- `bunx tsc --noEmit` -> zero errors under src/** (pre-existing errors only in examples/ and skills/, unrelated).
- Dev server: GET / -> 200; compiled without warnings for the four files.

## Notes for next agents
- Shared files untouched; no new dependencies added.
- If backend ever renames review categories, update CATEGORY_FILTERS in review-view.tsx.
- formError state in capa-view is shared between create and edit dialogs (only one is ever open at a time).
- Audit detail row uses both Tooltip (hover) and click-to-expand; rows are clickable, keyboard users can Tab to rows (native tr focus not added — acceptable for demo, could add tabIndex if requested).
