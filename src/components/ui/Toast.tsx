"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

const TOAST_EVENT = "denguewatch:toast";

type Listener = (toast: ToastItem) => void;
const listeners = new Set<Listener>();
const pendingQueue: ToastItem[] = [];

export function showToast(type: ToastType, message: string) {
  if (typeof window === "undefined") return;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  const item: ToastItem = { id, message, type };

  if (listeners.size === 0) {
    pendingQueue.push(item);
  } else {
    listeners.forEach((listener) => listener(item));
  }

  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: item }));
}

export const toast = {
  error: (message: string) => showToast("error", message),
  info: (message: string) => showToast("info", message),
  success: (message: string) => showToast("success", message),
};

function readAndClearCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match || !match[1]) return null;
  const value = decodeURIComponent(match[1]);
  document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  return value;
}

function ToastQueryListener() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;

    const auth = searchParams.get("auth");
    const toastParam = searchParams.get("toast");
    const keputusan = searchParams.get("keputusan");
    const informasi = searchParams.get("informasi");
    const logoutParam = searchParams.get("logout");

    let message: string | null = null;
    let type: ToastType = "success";

    if (auth === "login_success") {
      message = "Berhasil masuk! Mengalihkan ke dasbor...";
    } else if (auth === "registered") {
      message = "Pendaftaran berhasil! Akun Anda telah dibuat.";
    } else if (auth === "logged_out") {
      message = "Anda telah berhasil keluar dari akun.";
    } else if (logoutParam === "failed") {
      message = "Gagal keluar akun. Silakan coba kembali.";
      type = "error";
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
      showToast(type, message);

      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("auth");
      newParams.delete("toast");
      newParams.delete("keputusan");
      newParams.delete("informasi");
      newParams.delete("logout");

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
  const pathname = usePathname();

  useEffect(() => {
    const handleToastItem: Listener = (newToast) => {
      setToasts((prev) => {
        if (prev.some((item) => item.message === newToast.message)) {
          return prev;
        }
        return [...prev, newToast];
      });

      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== newToast.id));
      }, 4000);
    };

    listeners.add(handleToastItem);

    if (pendingQueue.length > 0) {
      const queue = [...pendingQueue];
      pendingQueue.length = 0;
      queue.forEach((item) => handleToastItem(item));
    }

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastItem>;
      if (customEvent.detail) {
        handleToastItem(customEvent.detail);
      }
    };

    window.addEventListener(TOAST_EVENT, handleCustomEvent);

    return () => {
      listeners.delete(handleToastItem);
      window.removeEventListener(TOAST_EVENT, handleCustomEvent);
    };
  }, []);

  // Check for cookie toasts on mount and route changes
  useEffect(() => {
    const toastCookie = readAndClearCookie("dw_toast");
    if (!toastCookie) return;

    if (toastCookie === "login_success") {
      showToast("success", "Berhasil masuk! Mengalihkan ke dasbor...");
    } else if (toastCookie === "logged_out") {
      showToast("success", "Anda telah berhasil keluar dari akun.");
    } else if (toastCookie === "registered") {
      showToast("success", "Pendaftaran berhasil! Akun Anda telah dibuat.");
    }
  }, [pathname]);

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
                className="size-5 shrink-0 text-[var(--primary)]"
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
