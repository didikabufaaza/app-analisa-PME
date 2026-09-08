"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

// Timeout aktivitas 3 menit (180.000 ms)
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

export function useIdleLogout() {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();

    const triggerLogout = () => {
      logout("Sesi Anda telah berakhir otomatis karena tidak ada aktivitas selama 3 menit. Silakan masuk kembali.");
    };

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(triggerLogout, IDLE_TIMEOUT_MS);
    };

    // Batasi frekuensi event (throttle) 1 detik untuk menghemat performa browser
    let throttled = false;
    const onUserActivity = () => {
      if (throttled) return;
      throttled = true;
      resetTimer();
      setTimeout(() => {
        throttled = false;
      }, 1000);
    };

    // Dengarkan seluruh interaksi pengguna (mouse, keyboard, scroll, touch)
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "wheel"];
    events.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Mulai timer awal 3 menit
    resetTimer();

    // Pengecekan berkala (setiap 15 detik) untuk menangani tab yang di-minimize atau sleep
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        triggerLogout();
      }
    }, 15_000);

    // Deteksi saat tab kembali dibuka / aktif
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
          triggerLogout();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      events.forEach((evt) => {
        window.removeEventListener(evt, onUserActivity);
      });
    };
  }, [user?.id, logout]);
}
