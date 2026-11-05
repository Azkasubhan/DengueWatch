"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

const TOAST_EVENT = "denguewatch:toast";

function dispatchToast(type: ToastType, message: string) {
  if (typeof window === "undefined") return;
  const id = crypto.randomUUID();
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, { detail: { id, message, type } }),
  );
}

export const toast = {
  error: (message: string) => dispatchToast("error", message),
  info: (message: string) => dispatchToast("info", message),
  success: (message: string) => dispatchToast("success", message),
};

function ToastQueryListener() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;

    const auth = searchParams.get("auth");
    const toastParam = searchParams.get("toast");
    const keputusan = searchParams.get("keputusan");
    const informasi = searchParams.get("informasi");

    let message: string | null = null;
    const type: ToastType = "success";

    if (auth === "login_success") {
      message = "Berhasil masuk! Mengalihkan ke dasbor...";
    } else if (auth === "registered") {
      message = "Pendaftaran berhasil! Akun Anda telah dibuat.";
    } else if (keputusan === "tersimpan") {
      message = "Keputusan verifikasi berhasil disimpan.";
    } else if (informasi === "terkirim") {
      message = "Keterangan tambahan berhasil dikirim.";
    } else if (toastParam) {
      try {
        message = decodeURIComponent(toastParam);
      } catch {
        message = toastParam;
      }
    }

    if (message) {
      dispatchToast(type, message);

      // Clean search parameters without triggering a full page reload
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("auth");
      newParams.delete("toast");
      newParams.delete("keputusan");
      newParams.delete("informasi");

      const query = newParams.toString();
      const newUrl = query
        ? `${window.location.pathname}?${query}`
        : window.location.pathname;

      window.history.replaceState(null, "", newUrl);
    }
  }, [searchParams]);

  return null;
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(e: Event) {
      const customEvent = e as CustomEvent<ToastItem>;
      if (!customEvent.detail) return;
      const newToast = customEvent.detail;

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== newToast.id));
      }, 3500);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <>
      <Suspense fallback={null}>
        <ToastQueryListener />
      </Suspense>

      <div
        aria-live="polite"
        className="pointer-events-none fixed top-5 right-5 z-[9999] flex w-full max-w-sm flex-col gap-2.5 px-4"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-lg backdrop-blur-xs transition-all duration-200 animate-in slide-in-from-top-3 fade-in"
          >
            {item.type === "success" ? (
              <CheckCircle2
                aria-hidden="true"
                className="size-5 shrink-0 text-emerald-600"
              />
            ) : item.type === "error" ? (
              <AlertCircle
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--danger)]"
              />
            ) : (
              <Info
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--info)]"
              />
            )}
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-[var(--foreground)]">
              {item.message}
            </p>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              aria-label="Tutup notifikasi"
              className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sand)] hover:text-[var(--foreground)]"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
