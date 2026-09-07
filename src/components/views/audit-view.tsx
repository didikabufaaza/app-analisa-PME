"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, Loader2, Search } from "lucide-react";

import { ApiError, apiGet } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { AuditLogData } from "@/types/pme";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BadgeStyle = string;

const ACTION_BADGE: Record<string, BadgeStyle> = {
  LOGIN: "bg-slate-100 text-slate-700 border-slate-200",
  UPLOAD: "bg-teal-100 text-teal-800 border-teal-200",
  DELETE_SESSION: "bg-red-100 text-red-800 border-red-200",
  EDIT_RESULT: "bg-amber-100 text-amber-800 border-amber-200",
  REVIEW_ACCEPT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW_REJECT: "bg-red-100 text-red-800 border-red-200",
  REPROCESS: "bg-teal-100 text-teal-800 border-teal-200",
  CREATE_CAPA: "bg-violet-100 text-violet-800 border-violet-200",
  UPDATE_CAPA: "bg-violet-100 text-violet-800 border-violet-200",
  UPDATE_RULES: "bg-amber-100 text-amber-800 border-amber-200",
  GENERATE_REPORT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ANALYZE: "bg-teal-100 text-teal-800 border-teal-200",
  REGISTER: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const DEFAULT_BADGE = "bg-slate-100 text-slate-700 border-slate-200";

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

function detailsText(details: Record<string, unknown> | null): string {
  if (!details || typeof details !== "object") return "";
  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
}

export function AuditView() {
  const { toast } = useToast();

  const [logs, setLogs] = useState<AuditLogData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ logs: AuditLogData[] }>("/api/audit-logs");
      setLogs(data.logs ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat log audit.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const haystack = [
        log.action,
        log.user?.name ?? "",
        log.user?.email ?? "",
        log.entityType ?? "",
        log.entityId ?? "",
        detailsText(log.details),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, query]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Log Audit</h2>
        <p className="text-sm text-muted-foreground">
          Jejak aktivitas pengguna untuk kepatuhan ISO/IEC 17043 dan ketertelusuran hasil.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-teal-600" />
            Aktivitas Sistem
            {!loading && logs ? (
              <span className="text-sm font-normal text-muted-foreground">({filtered.length} entri)</span>
            ) : null}
          </CardTitle>
          <CardDescription>Daftar semua aksi penting yang terjadi pada sistem.</CardDescription>
          <div className="relative mt-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari aksi, pengguna, parameter…"
              className="pl-8"
              aria-label="Cari log audit"
            />
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={() => void fetchLogs()}>
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <History className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">{query ? "Tidak ada hasil yang cocok" : "Belum ada aktivitas tercatat"}</p>
              <p className="text-xs text-muted-foreground">
                {query ? "Coba kata kunci lain untuk memperluas pencarian." : "Aktivitas akan muncul setelah sistem digunakan."}
              </p>
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="max-h-[36rem] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <TableRow>
                      <TableHead className="w-[170px]">Waktu</TableHead>
                      <TableHead className="w-[180px]">Pengguna</TableHead>
                      <TableHead className="w-[160px]">Aksi</TableHead>
                      <TableHead className="w-[200px]">Entitas</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((log) => {
                      const detail = detailsText(log.details);
                      const isExpanded = expandedId === log.id;
                      const truncated = detail.length > 80 ? `${detail.slice(0, 80)}…` : detail;
                      return (
                        <TableRow
                          key={log.id}
                          className={isExpanded ? "bg-muted/40" : undefined}
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          <TableCell className="whitespace-nowrap text-muted-foreground">{fmtTimestamp(log.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{log.user?.name || "Sistem"}</span>
                              {log.user?.email ? (
                                <span className="text-xs text-muted-foreground">{log.user.email}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`border ${ACTION_BADGE[log.action] ?? DEFAULT_BADGE}`}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="text-muted-foreground">{log.entityType || "—"}</span>
                            {log.entityId ? <span className="ml-1 font-mono text-xs">{shortId(log.entityId)}</span> : null}
                          </TableCell>
                          <TableCell className="max-w-[320px]">
                            {detail ? (
                              isExpanded ? (
                                <span className="block break-all whitespace-pre-wrap font-mono text-xs">{detail}</span>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block cursor-pointer truncate font-mono text-xs text-muted-foreground">
                                      {truncated}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-md">
                                    <span className="block max-h-64 overflow-y-auto break-all whitespace-pre-wrap font-mono text-xs">
                                      {detail}
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
