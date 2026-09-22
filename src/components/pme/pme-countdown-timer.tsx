"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PmeCountdownTimerProps {
  deadline?: string | Date | null;
  isSubmissionOpen?: boolean;
  cycle?: string;
  period?: string;
  variant?: "login" | "banner" | "compact";
  onExpire?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isExpired: boolean;
}

export function PmeCountdownTimer({
  deadline,
  isSubmissionOpen = true,
  cycle,
  period,
  variant = "banner",
  onExpire,
}: PmeCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!deadline) {
      setTimeLeft(null);
      return;
    }

    const targetDate = new Date(deadline).getTime();

    const calculateTime = () => {
      const now = Date.now();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalMs: 0,
          isExpired: true,
        });
        onExpire?.();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        totalMs: diff,
        isExpired: false,
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  // Status Closed by Superadmin
  if (!isSubmissionOpen) {
    if (variant === "login") {
      return (
        <div className="relative z-10 mt-3 p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/70 backdrop-blur-md text-white shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-200">Pengisian Hasil PME Sedang Ditutup</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                Superadmin saat ini menonaktifkan proses pengisian hasil pengujian untuk siklus ini.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200">
        <div className="flex items-center gap-2.5">
          <Lock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <span className="font-semibold">Pengisian Hasil PME Sedang Dinonaktifkan oleh Superadmin</span>
        </div>
        <Badge variant="destructive" className="text-[10px]">PENGISIAN DITUTUP</Badge>
      </div>
    );
  }

  // Jika deadline belum diset
  if (!deadline) {
    if (variant === "login") return null;
    return null;
  }

  // Jika Waktu Habis (EXPIRED)
  if (timeLeft?.isExpired) {
    if (variant === "login") {
      return (
        <div className="relative z-10 mt-3.5 p-3.5 rounded-xl border-2 border-rose-500/50 bg-gradient-to-r from-rose-950/90 via-slate-950/90 to-rose-950/90 shadow-[0_4px_20px_rgba(244,63,94,0.3)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
              <span>Batas Waktu Pengisian Hasil PME Telah Berakhir</span>
            </div>
            <Badge variant="destructive" className="text-[9.5px] uppercase font-bold tracking-wider">
              WAKTU HABIS
            </Badge>
          </div>
          <p className="text-[11px] text-rose-200/80 mt-1">
            Batas pengisian: {new Date(deadline).toLocaleString("id-ID")}. Hubungi Superadmin untuk mengajukan perpanjangan waktu pengisian.
          </p>
        </div>
      );
    }

    return (
      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <div>
            <div className="flex items-center gap-2 font-bold text-xs">
              <span>Batas Waktu Pengisian PME Telah Berakhir</span>
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">WAKTU HABIS</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Waktu pengisian resmi telah berakhir pada <strong>{new Date(deadline).toLocaleString("id-ID")}</strong>. Formulir terkunci kecuali jika Superadmin memberikan akses khusus pengisian.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Jika Sedang Berjalan Mundur (COUNTDOWN RUNNING)
  const format2 = (n: number) => String(n).padStart(2, "0");

  if (variant === "login") {
    return (
      <div className="relative z-10 mt-3.5 p-3.5 rounded-xl border border-teal-500/40 bg-gradient-to-r from-teal-950/85 via-[#082a2a]/85 to-teal-950/85 shadow-[0_4px_25px_rgba(20,184,166,0.25)] backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-400"></span>
            </span>
            <Clock className="h-4 w-4 text-teal-300" />
            <span className="text-xs font-bold text-white tracking-wide">
              Batas Waktu Pengisian Hasil PME
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono text-xs font-black">
            <span className="bg-teal-500/20 text-teal-200 px-2 py-0.5 rounded border border-teal-500/30">
              {format2(timeLeft?.days || 0)} <span className="text-[9px] font-sans font-normal text-teal-300">Hari</span>
            </span>
            <span className="text-teal-400">:</span>
            <span className="bg-teal-500/20 text-teal-200 px-2 py-0.5 rounded border border-teal-500/30">
              {format2(timeLeft?.hours || 0)} <span className="text-[9px] font-sans font-normal text-teal-300">Jam</span>
            </span>
            <span className="text-teal-400">:</span>
            <span className="bg-teal-500/20 text-teal-200 px-2 py-0.5 rounded border border-teal-500/30">
              {format2(timeLeft?.minutes || 0)} <span className="text-[9px] font-sans font-normal text-teal-300">Mnt</span>
            </span>
            <span className="text-teal-400">:</span>
            <span className="bg-amber-500/25 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 animate-pulse">
              {format2(timeLeft?.seconds || 0)} <span className="text-[9px] font-sans font-normal text-amber-200">Dtk</span>
            </span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-teal-500/20 flex items-center justify-between text-[10.5px] text-teal-200/70">
          <span>Batas Akhir: {new Date(deadline).toLocaleString("id-ID")}</span>
          <span className="font-semibold text-teal-300">{cycle || "Siklus 1 2026"}</span>
        </div>
      </div>
    );
  }

  // Default Banner Variant (for PmeInputView)
  return (
    <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-transparent border border-teal-500/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-teal-500/20 text-teal-600 dark:text-teal-400 shrink-0">
          <Clock className="h-4.5 w-4.5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2 font-bold text-xs text-foreground">
            <span>Hitung Mundur Batas Waktu Pengisian Hasil PME</span>
            <Badge className="bg-teal-600 text-white text-[9.5px] font-mono font-normal px-1.5 py-0">
              {cycle || "Siklus Aktif"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Batas akhir pengisian: <strong>{new Date(deadline).toLocaleString("id-ID")}</strong>. Pastikan data dikirim sebelum batas waktu berakhir.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 font-mono font-bold shrink-0 self-start md:self-auto">
        <div className="flex flex-col items-center bg-card border rounded-lg px-2.5 py-1 shadow-xs">
          <span className="text-sm font-extrabold text-teal-700 dark:text-teal-300">
            {format2(timeLeft?.days || 0)}
          </span>
          <span className="text-[9px] text-muted-foreground font-sans font-medium uppercase">Hari</span>
        </div>
        <span className="text-base text-muted-foreground font-bold">:</span>
        <div className="flex flex-col items-center bg-card border rounded-lg px-2.5 py-1 shadow-xs">
          <span className="text-sm font-extrabold text-teal-700 dark:text-teal-300">
            {format2(timeLeft?.hours || 0)}
          </span>
          <span className="text-[9px] text-muted-foreground font-sans font-medium uppercase">Jam</span>
        </div>
        <span className="text-base text-muted-foreground font-bold">:</span>
        <div className="flex flex-col items-center bg-card border rounded-lg px-2.5 py-1 shadow-xs">
          <span className="text-sm font-extrabold text-teal-700 dark:text-teal-300">
            {format2(timeLeft?.minutes || 0)}
          </span>
          <span className="text-[9px] text-muted-foreground font-sans font-medium uppercase">Menit</span>
        </div>
        <span className="text-base text-muted-foreground font-bold">:</span>
        <div className="flex flex-col items-center bg-teal-500/15 border border-teal-500/30 rounded-lg px-2.5 py-1 shadow-xs">
          <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
            {format2(timeLeft?.seconds || 0)}
          </span>
          <span className="text-[9px] text-teal-600 font-sans font-medium uppercase">Detik</span>
        </div>
      </div>
    </div>
  );
}
