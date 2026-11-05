"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

export type LightboxPhotoItem = {
  id: string;
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
};

type PhotoLightboxButtonProps = {
  count: number;
  fetchUrl: string;
  labelType?: "foto" | "bukti";
  title: string;
  subtitle?: string;
  emptyText?: string;
  hideWhenEmpty?: boolean;
  initialPhotos?: LightboxPhotoItem[];
  className?: string;
};

export function PhotoLightboxButton({
  count,
  fetchUrl,
  labelType = "foto",
  title,
  subtitle,
  emptyText = "Tidak ada foto",
  hideWhenEmpty = false,
  initialPhotos,
  className = "",
}: PhotoLightboxButtonProps) {
  const dialogTitleId = useId();
  const dialogDescId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [photos, setPhotos] = useState<LightboxPhotoItem[]>(
    initialPhotos ?? [],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const loadPhotos = useCallback(async () => {
    setIsFetching(true);
    setErrorMessage(null);
    try {
      const response = await fetch(fetchUrl, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "Foto belum dapat dimuat saat ini.",
        );
      }
      const payload = (await response.json()) as {
        data?: LightboxPhotoItem[];
      };
      const items = payload.data ?? [];
      if (items.length === 0) {
        setErrorMessage("Tidak ada foto yang ditemukan untuk item ini.");
        setPhotos([]);
      } else {
        setPhotos(items);
        setActiveIndex((prev) => (prev < items.length ? prev : 0));
        setIsImageLoading(true);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Gagal memuat foto. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setIsFetching(false);
    }
  }, [fetchUrl]);

  function openLightbox() {
    setIsOpen(true);
    setActiveIndex(0);
    setErrorMessage(null);
    void loadPhotos();
  }

  const closeLightbox = useCallback(() => {
    setIsOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  // Focus management and keyboard navigation inside dialog
  useEffect(() => {
    if (!isOpen) return;

    const timer = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
        return;
      }
      if (e.key === "ArrowLeft" && photos.length > 1) {
        e.preventDefault();
        setIsImageLoading(true);
        setErrorMessage(null);
        setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length);
        return;
      }
      if (e.key === "ArrowRight" && photos.length > 1) {
        e.preventDefault();
        setIsImageLoading(true);
        setErrorMessage(null);
        setActiveIndex((prev) => (prev + 1) % photos.length);
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, photos.length, closeLightbox]);

  if (count <= 0) {
    if (hideWhenEmpty) return null;
    return (
      <span className="text-xs text-[var(--muted-foreground)]">
        {emptyText}
      </span>
    );
  }

  const buttonText =
    labelType === "bukti"
      ? count > 1
        ? `Lihat bukti (${count})`
        : "Lihat bukti"
      : count > 1
        ? `Lihat foto (${count})`
        : "Lihat foto";

  const currentPhoto = photos[activeIndex];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openLightbox}
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-subtle)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${className}`}
      >
        <Eye aria-hidden="true" className="size-3.5 shrink-0" />
        <span>{buttonText}</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 backdrop-blur-xs sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={subtitle ? dialogDescId : undefined}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-xl"
          >
            {/* Header Dialog */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
              <div className="min-w-0">
                <h2
                  id={dialogTitleId}
                  className="truncate text-sm font-bold text-[var(--foreground)] sm:text-base"
                >
                  {title}
                </h2>
                {subtitle ? (
                  <p
                    id={dialogDescId}
                    className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]"
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {photos.length > 1 ? (
                  <span
                    aria-live="polite"
                    className="rounded-full bg-[var(--sand)] px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--foreground)]"
                  >
                    {activeIndex + 1} / {photos.length}
                  </span>
                ) : null}
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeLightbox}
                  aria-label="Tutup dialog foto"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>

            {/* Body / Viewport Foto */}
            <div className="relative flex min-h-[280px] flex-1 flex-col items-center justify-center overflow-auto bg-[var(--background)] p-3 sm:min-h-[380px] sm:p-5">
              {isFetching ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-col items-center gap-2.5 py-12 text-center"
                >
                  <Loader2
                    aria-hidden="true"
                    className="size-7 animate-spin text-[var(--primary)]"
                  />
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Memuat tautan foto terotorisasi…
                  </p>
                </div>
              ) : errorMessage ? (
                <div
                  role="alert"
                  className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-5 text-center"
                >
                  <AlertCircle
                    aria-hidden="true"
                    className="size-6 text-[var(--danger)]"
                  />
                  <p className="text-xs font-semibold text-[var(--danger)] sm:text-sm">
                    {errorMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadPhotos()}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                  >
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    Muat ulang foto
                  </button>
                </div>
              ) : currentPhoto ? (
                <div className="relative flex w-full flex-col items-center justify-center">
                  {isImageLoading ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/75"
                    >
                      <Loader2
                        aria-hidden="true"
                        className="size-6 animate-spin text-[var(--primary)]"
                      />
                      <span className="sr-only">Memuat gambar…</span>
                    </div>
                  ) : null}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={currentPhoto.url}
                    src={currentPhoto.url}
                    alt={
                      currentPhoto.alt ??
                      `${title} - Foto ${activeIndex + 1} dari ${photos.length}`
                    }
                    onLoad={() => setIsImageLoading(false)}
                    onError={() => {
                      setIsImageLoading(false);
                      setErrorMessage(
                        "Tautan foto sementara gagal dimuat atau telah kedaluwarsa. Klik muat ulang untuk memperbarui tautan.",
                      );
                    }}
                    className="max-h-[65vh] w-auto max-w-full rounded-[var(--radius-control)] border border-[var(--border)] object-contain shadow-xs"
                  />

                  {currentPhoto.caption ? (
                    <p className="mt-3 max-w-xl text-center text-xs text-[var(--foreground)] sm:text-sm">
                      {currentPhoto.caption}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Footer Navigasi Multi-Foto */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
              {photos.length > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImageLoading(true);
                      setErrorMessage(null);
                      setActiveIndex(
                        (prev) => (prev - 1 + photos.length) % photos.length,
                      );
                    }}
                    disabled={isFetching}
                    className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] disabled:opacity-50"
                  >
                    <ChevronLeft aria-hidden="true" className="size-3.5" />
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsImageLoading(true);
                      setErrorMessage(null);
                      setActiveIndex((prev) => (prev + 1) % photos.length);
                    }}
                    disabled={isFetching}
                    className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] disabled:opacity-50"
                  >
                    Berikutnya
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </button>
                  <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                    Foto {activeIndex + 1} dari {photos.length}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {photos.length === 1 ? "1 foto tersedia" : ""}
                </span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadPhotos()}
                  disabled={isFetching}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  <RefreshCw aria-hidden="true" className="size-3.5" />
                  Perbarui tautan
                </button>
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
