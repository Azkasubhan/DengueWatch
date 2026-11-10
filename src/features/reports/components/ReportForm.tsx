"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Camera,
  CheckCircle2,
  Disc,
  Droplets,
  HelpCircle,
  ImagePlus,
  Loader2,
  Navigation,
  PackageOpen,
  Sparkles,
  Trash2,
  Waves,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AreaSummary } from "@/features/areas/types";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { toast } from "@/components/ui/Toast";
import { controlClass } from "@/features/reports/components/reportAction";
import {
  reportCategories,
  reportCategoryLabels,
  type ReportCategory,
} from "@/features/reports/validation";

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type PhotoItem = {
  file: File;
  previewUrl: string;
};

type UploadedPhoto = {
  id: string;
  storagePath: string;
};

type AiStatus =
  "idle" | "uploading" | "analyzing" | "succeeded" | "unavailable";

type AiMetadata = {
  visibleObjects: string | null;
  preventionAdvice: string | null;
};

const categoryMeta: Record<ReportCategory, { icon: LucideIcon; hint: string }> =
  {
    water_container: {
      icon: Droplets,
      hint: "Ember, drum, bak, tandon, atau wadah terbuka",
    },
    discarded_tire: {
      icon: Disc,
      hint: "Ban bekas kendaraan yang dapat menampung air",
    },
    clogged_drain: {
      icon: Waves,
      hint: "Selokan mampet atau genangan air tidak mengalir",
    },
    discarded_item: {
      icon: PackageOpen,
      hint: "Kaleng, botol, pot, atau barang bekas di luar",
    },
    other: {
      icon: HelpCircle,
      hint: "Pilih ini jika ragu menentukan jenis temuan",
    },
  };

function makeKey() {
  return `dw_${crypto.randomUUID().replace(/-/g, "")}`;
}

function singleLine(value: string) {
  return value.replace(/[\r\n\t]+/g, " ");
}

function clientFileError(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Gunakan foto JPG, PNG, atau WebP.";
  }
  if (file.size < 16 || file.size > 5 * 1024 * 1024) {
    return "Ukuran setiap foto maksimal 5 MiB.";
  }
  return null;
}

export function ReportForm({ areas }: { areas: AreaSummary[] }) {
  const router = useRouter();
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [description, setDescription] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [geoState, setGeoState] = useState<
    "idle" | "loading" | "ready" | "denied" | "unavailable"
  >("idle");
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const photos = photoItems.map((item) => item.file);
  const previews = photoItems.map((item) => item.previewUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<{
    category?: boolean;
    description?: boolean;
  }>({});
  const [aiMetadata, setAiMetadata] = useState<AiMetadata>({
    visibleObjects: null,
    preventionAdvice: null,
  });

  const idempotencyKey = useRef<string | null>(null);
  const uploadedByFileRef = useRef<Map<File, UploadedPhoto>>(new Map());
  const analysisRunRef = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const valuesRef = useRef({ category, description });
  const aiFilledRef = useRef(aiFilledFields);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    valuesRef.current = { category, description };
  }, [category, description]);

  useEffect(() => {
    aiFilledRef.current = aiFilledFields;
  }, [aiFilledFields]);

  const photoItemsRef = useRef<PhotoItem[]>([]);

  useEffect(() => {
    photoItemsRef.current = photoItems;
  }, [photoItems]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errors]);

  useEffect(
    () => () => {
      analysisAbortRef.current?.abort();
      photoItemsRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl),
      );
    },
    [],
  );

  function resetAttemptKey() {
    idempotencyKey.current = null;
  }

  function releaseUpload(upload: UploadedPhoto | undefined) {
    if (!upload) return;
    void fetch(`/api/v1/report-uploads/${upload.id}`, {
      method: "DELETE",
    }).catch(() => undefined);
  }

  async function uploadPhoto(file: File, signal?: AbortSignal) {
    const body = new FormData();
    body.set("photo", file);
    const response = await fetch("/api/v1/report-uploads", {
      method: "POST",
      body,
      signal,
    });
    const payload = await response.json().catch(() => null);
    const uploadData = (payload?.data ?? payload) as UploadedPhoto | undefined;
    if (!response.ok || !uploadData?.id) {
      throw new Error(
        payload?.error?.message ?? "Foto belum dapat diunggah. Coba lagi.",
      );
    }
    return uploadData as UploadedPhoto;
  }

  async function analyzeFirstPhoto(file: File, existingUpload?: UploadedPhoto) {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const run = ++analysisRunRef.current;
    setAiNotice(null);

    let upload = existingUpload ?? uploadedByFileRef.current.get(file);
    try {
      if (!upload) {
        setAiStatus("uploading");
        upload = await uploadPhoto(file, controller.signal);
        if (analysisRunRef.current !== run) {
          releaseUpload(upload);
          return;
        }
        uploadedByFileRef.current.set(file, upload);
      }
      setAiStatus("analyzing");
      const response = await fetch("/api/v1/ai/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          areaId,
          uploadId: upload.id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (analysisRunRef.current !== run) return;
      const suggestion = payload?.data?.suggestion;
      if (!response.ok || !suggestion) {
        setAiStatus("unavailable");
        setAiNotice(
          payload?.error?.message ??
            "Analisis AI belum tersedia. Silakan pilih kategori dan tulis keterangan secara manual.",
        );
        return;
      }

      const current = valuesRef.current;
      const currentAi = aiFilledRef.current;
      const nextAi: { category?: boolean; description?: boolean } = {};
      let preservedUserEdits = false;

      if (!current.category || currentAi.category) {
        setCategory(suggestion.suggestedCategory);
        nextAi.category = true;
      } else {
        preservedUserEdits = true;
      }

      const draftText = singleLine(
        String(suggestion.draftDescription ?? ""),
      ).trim();
      if ((!current.description.trim() || currentAi.description) && draftText) {
        setDescription(draftText);
        nextAi.description = true;
      } else if (current.description.trim()) {
        preservedUserEdits = true;
      }

      const visibleStr = Array.isArray(suggestion.visibleObjects)
        ? singleLine(suggestion.visibleObjects.join(", ")).trim()
        : "";
      const adviceStr = singleLine(
        String(suggestion.suggestedPrecaution ?? ""),
      ).trim();

      setAiMetadata({
        visibleObjects:
          visibleStr.length >= 5 ? visibleStr.slice(0, 500) : null,
        preventionAdvice:
          adviceStr.length >= 10 ? adviceStr.slice(0, 500) : null,
      });

      setAiFilledFields(nextAi);
      setErrors((currentErrors) => {
        const next = { ...currentErrors };
        if (nextAi.category) delete next.category;
        if (nextAi.description) delete next.description;
        return next;
      });
      setAiStatus("succeeded");
      setAiNotice(
        preservedUserEdits
          ? "AI mengisi bagian yang masih kosong. Kolom yang sudah Anda isi tidak diubah."
          : "AI mengisi draf kategori dan keterangan dari foto pertama. Silakan periksa sebelum mengirim.",
      );
    } catch (err) {
      if (analysisRunRef.current !== run) return;
      if (controller.signal.aborted) {
        setAiStatus("unavailable");
        setAiNotice(
          "Analisis AI dibatalkan. Anda dapat mengisi form secara manual.",
        );
        return;
      }
      setAiStatus("unavailable");
      setAiNotice(
        err instanceof Error && err.message
          ? err.message
          : "Analisis AI belum tersedia. Silakan pilih kategori dan tulis keterangan secara manual.",
      );
    }
  }

  function cancelAnalysis() {
    analysisRunRef.current += 1;
    analysisAbortRef.current?.abort();
    setAiStatus("unavailable");
    setAiNotice(
      "Analisis AI dibatalkan. Anda dapat mengisi form secara manual.",
    );
  }

  function validateClient() {
    const next: Record<string, string> = {};
    if (!areaId) next.areaId = "Pilih wilayah pelaporan.";
    if (photos.length < 1) {
      next.photos = "Tambahkan minimal satu foto.";
    } else if (photos.length > 3) {
      next.photos = "Maksimal 3 foto per laporan.";
    } else {
      for (const photo of photos) {
        const error = clientFileError(photo);
        if (error) {
          next.photos = error;
          break;
        }
      }
    }
    if (!category) next.category = "Pilih kategori temuan.";
    const cleanDescription = singleLine(description).trim();
    if (cleanDescription.length < 10) {
      next.description =
        "Ceritakan temuan Anda minimal 10 karakter (contoh: jenis wadah dan posisinya).";
    } else if (cleanDescription.length > 1000) {
      next.description = "Keterangan maksimal 1000 karakter.";
    }
    if (singleLine(locationNote).trim().length > 250) {
      next.locationNote = "Petunjuk lokasi maksimal 250 karakter.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (incoming.length === 0) return;

    resetAttemptKey();
    setSubmitError(null);

    const combined = [...photos, ...incoming];
    if (combined.length > 3) {
      setErrors((current) => ({
        ...current,
        photos:
          "Maksimal 3 foto per laporan. Hapus salah satu foto jika ingin menggantinya.",
      }));
      return;
    }

    for (const file of incoming) {
      const fileErr = clientFileError(file);
      if (fileErr) {
        setErrors((current) => ({ ...current, photos: fileErr }));
        return;
      }
    }

    const hadPhotosBefore = photoItems.length > 0;
    const newItems: PhotoItem[] = incoming.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    const nextItems = [...photoItems, ...newItems];
    setPhotoItems(nextItems);
    setErrors((current) => {
      const rest = { ...current };
      delete rest.photos;
      return rest;
    });

    if (!hadPhotosBefore && nextItems[0]) {
      void analyzeFirstPhoto(nextItems[0].file);
    }
  }

  function removePhoto(index: number) {
    resetAttemptKey();
    const removed = photoItems[index];
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      const upload = uploadedByFileRef.current.get(removed.file);
      if (upload) {
        releaseUpload(upload);
        uploadedByFileRef.current.delete(removed.file);
      }
    }
    const next = photoItems.filter((_, itemIndex) => itemIndex !== index);
    setPhotoItems(next);

    if (index === 0) {
      analysisRunRef.current += 1;
      analysisAbortRef.current?.abort();
      if (next[0]) {
        const existingUpload = uploadedByFileRef.current.get(next[0].file);
        void analyzeFirstPhoto(next[0].file, existingUpload);
      } else {
        setAiStatus("idle");
        setAiNotice(null);
      }
    }
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("unavailable");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resetAttemptKey();
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
        setGeoState("ready");
      },
      (error) => {
        setCoordinates(null);
        setGeoState(error.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    if (!validateClient()) return;

    if (aiStatus === "uploading" || aiStatus === "analyzing") {
      analysisRunRef.current += 1;
      analysisAbortRef.current?.abort();
      setAiStatus("unavailable");
    }

    setSubmitting(true);
    try {
      const uploadIds: string[] = [];
      for (const [index, photo] of photos.entries()) {
        let existing = uploadedByFileRef.current.get(photo);
        if (!existing) {
          setUploadStep(
            `Mengunggah foto ${index + 1} dari ${photos.length}...`,
          );
          existing = await uploadPhoto(photo);
          uploadedByFileRef.current.set(photo, existing);
        }
        uploadIds.push(existing.id);
      }

      setUploadStep("Menyimpan laporan...");
      idempotencyKey.current ??= makeKey();

      const payload: Record<string, unknown> = {
        areaId,
        category,
        description: singleLine(description).trim(),
        imageUploadIds: uploadIds,
        location:
          coordinates || locationNote.trim()
            ? {
                latitude: coordinates?.latitude ?? null,
                longitude: coordinates?.longitude ?? null,
                ...(locationNote.trim()
                  ? { note: singleLine(locationNote).trim() }
                  : {}),
              }
            : null,
      };

      if (aiMetadata.visibleObjects) {
        payload.visibleObjects = aiMetadata.visibleObjects;
      }
      if (aiMetadata.preventionAdvice) {
        payload.preventionAdvice = aiMetadata.preventionAdvice;
      }

      const response = await fetch("/api/v1/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.data?.id) {
        if (response.status === 409) {
          uploadedByFileRef.current.clear();
          resetAttemptKey();
        }
        if (result?.error?.fieldErrors) {
          setErrors(result.error.fieldErrors);
        }
        throw new Error(
          result?.error?.message ?? "Laporan belum dapat disimpan. Coba lagi.",
        );
      }

      const refLabel = result.data.publicReference
        ? ` (${result.data.publicReference})`
        : "";
      toast.success(
        `Laporan${refLabel} berhasil dikirim dan menunggu pemeriksaan pengelola.`,
      );
      router.push(`/app/laporan/${result.data.id}?status=terkirim`);
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Laporan belum dapat disimpan. Coba lagi.",
      );
      setSubmitting(false);
      setUploadStep(null);
    }
  }

  const errorEntries = Object.entries(errors);

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="grid gap-5"
      aria-label="Formulir laporan lingkungan"
    >
      {/* Ringkasan validasi yang dapat menerima fokus */}
      {errorEntries.length > 0 ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="report-errors-title"
          className="rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          <p
            id="report-errors-title"
            className="font-bold text-[var(--danger)]"
          >
            Periksa kembali bagian berikut sebelum mengirim:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorEntries.map(([field, message]) => (
              <li key={field}>
                <a
                  href={`#${field}`}
                  className="font-semibold text-[var(--primary)] underline underline-offset-2"
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-sm"
        >
          <p className="font-bold text-[var(--danger)]">{submitError}</p>
          <p className="mt-1 text-xs text-[var(--foreground)]">
            Isian dan foto Anda tetap tersimpan di halaman ini. Silakan coba
            kirim kembali.
          </p>
        </div>
      ) : null}

      {/* A. FOTO TEMUAN */}
      <section
        aria-labelledby="section-photos-title"
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2
              id="section-photos-title"
              className="text-base font-bold text-[var(--foreground)]"
            >
              1. Foto temuan <span aria-hidden="true">*</span>
            </h2>
            <p
              id="photos-help"
              className="mt-0.5 text-xs text-[var(--muted-foreground)]"
            >
              Unggah 1–3 foto (JPG, PNG, atau WebP, maks. 5 MiB per foto).
              Hindari memotret wajah orang atau dokumen pribadi.
            </p>
          </div>
          <span
            id="photos-selected"
            className="rounded-full bg-[var(--background)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]"
          >
            {photos.length > 0
              ? `${photos.length}/3 foto dipilih`
              : "Belum ada foto"}
          </span>
        </div>

        {/* Area unggah / tambah foto */}
        <div className="mt-3.5 rounded-xl border-2 border-dashed border-[var(--control-border)] bg-[var(--background)] p-4 sm:p-5 transition hover:border-[var(--primary)]">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)]">
                <ImagePlus aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {photos.length === 0
                    ? "Tambahkan foto kondisi lingkungan"
                    : photos.length < 3
                      ? "Anda dapat menambahkan hingga 3 foto"
                      : "Batas maksimal 3 foto telah tercapai"}
                </p>
                <p
                  id="photos-ai-notice"
                  className="mt-0.5 text-xs text-[var(--muted-foreground)]"
                >
                  Foto pertama akan dianalisis AI untuk membantu mengisi draf
                  kategori dan keterangan.
                </p>
              </div>
            </div>

            {photos.length < 3 ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 sm:ml-auto">
                <input
                  id="photos"
                  name="photos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  aria-describedby={
                    errors.photos
                      ? "photos-help photos-ai-notice photos-error"
                      : "photos-help photos-ai-notice"
                  }
                  aria-invalid={Boolean(errors.photos)}
                  onChange={onPhotoChange}
                  className="peer sr-only"
                />
                <label
                  htmlFor="photos"
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--primary-hover)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)]"
                >
                  <ImagePlus aria-hidden="true" className="size-4 shrink-0" />
                  <span>Pilih foto</span>
                </label>

                <input
                  id="camera-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={onPhotoChange}
                  className="peer/camera sr-only"
                />
                <label
                  htmlFor="camera-photo"
                  className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] shadow-2xs transition hover:border-[var(--primary)] hover:text-[var(--primary)] peer-focus-visible/camera:outline-2 peer-focus-visible/camera:outline-offset-2 peer-focus-visible/camera:outline-[var(--primary)]"
                >
                  <Camera
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[var(--primary)]"
                  />
                  <span>Ambil foto</span>
                </label>
              </div>
            ) : null}
          </div>

          {/* Daftar thumbnail foto yang sudah dipilih */}
          {previews.length > 0 ? (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {previews.map((url, index) => (
                <li
                  key={url}
                  className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                >
                  <div className="relative">
                    <Image
                      unoptimized
                      src={url}
                      alt={`Pratinjau foto ${index + 1}`}
                      width={320}
                      height={220}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {index === 0 ? (
                      <span className="absolute top-2 left-2 rounded-md bg-[var(--surface)]/95 px-2 py-0.5 text-[11px] font-bold text-[var(--primary)] shadow-2xs">
                        Foto 1 · Utama
                      </span>
                    ) : (
                      <span className="absolute top-2 left-2 rounded-md bg-[var(--surface)]/90 px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)]">
                        Foto {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="truncate text-[var(--muted-foreground)]">
                      {photos[index]?.name ?? `Foto ${index + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--danger)] hover:underline"
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                      Hapus foto {index + 1}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {errors.photos ? (
          <p
            id="photos-error"
            className="mt-2 text-xs font-semibold text-[var(--danger)]"
          >
            {errors.photos}
          </p>
        ) : null}

        {/* Status analisis AI ringkas tepat di bawah foto */}
        {aiStatus === "uploading" || aiStatus === "analyzing" ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--primary-subtle)]/50 px-3.5 py-2.5 text-xs"
          >
            <span className="inline-flex items-center gap-2 font-semibold text-[var(--foreground)]">
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin text-[var(--primary)]"
              />
              {aiStatus === "uploading"
                ? "Mengunggah foto pertama untuk dianalisis AI..."
                : "AI sedang membaca foto pertama untuk menyarankan kategori & keterangan..."}
            </span>
            <button
              type="button"
              onClick={cancelAnalysis}
              className="font-semibold text-[var(--primary)] underline underline-offset-2"
            >
              Batalkan analisis
            </button>
          </div>
        ) : null}

        {aiStatus === "succeeded" && aiNotice ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--primary)]/30 bg-[var(--primary-subtle)]/60 px-3.5 py-2.5 text-xs text-[var(--foreground)]"
          >
            <Sparkles
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--primary)]"
            />
            <span>{aiNotice}</span>
          </div>
        ) : null}

        {aiStatus === "unavailable" && aiNotice ? (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-xs text-[var(--muted-foreground)]"
          >
            <span>{aiNotice}</span>
            {photos[0] ? (
              <button
                type="button"
                onClick={() =>
                  void analyzeFirstPhoto(
                    photos[0]!,
                    uploadedByFileRef.current.get(photos[0]!),
                  )
                }
                className="font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                Analisis ulang
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* B. KATEGORI TEMUAN */}
      <section
        aria-labelledby="section-category-title"
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="section-category-title"
              className="text-base font-bold text-[var(--foreground)]"
            >
              2. Kategori temuan <span aria-hidden="true">*</span>
            </h2>
            <p
              id="category-help"
              className="mt-0.5 text-xs text-[var(--muted-foreground)]"
            >
              Pilih jenis objek yang paling sesuai. Pilih{" "}
              <strong>Temuan lain</strong> bila Anda ragu.
            </p>
          </div>
          {aiFilledFields.category ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
              <Sparkles aria-hidden="true" className="size-3" />
              Disarankan AI
            </span>
          ) : null}
        </div>

        <div className="mt-3.5 max-w-xl">
          <CustomSelect
            id="category"
            name="category"
            value={category}
            size="md"
            placeholder="Pilih kategori temuan…"
            aria-invalid={Boolean(errors.category)}
            aria-describedby={
              errors.category ? "category-help category-error" : "category-help"
            }
            onChange={(val) => {
              resetAttemptKey();
              setCategory(val as ReportCategory);
              setAiFilledFields((curr) => ({ ...curr, category: false }));
              setErrors((curr) => {
                const next = { ...curr };
                delete next.category;
                return next;
              });
            }}
            options={reportCategories.map((item) => ({
              value: item,
              label: `${reportCategoryLabels[item]} — ${categoryMeta[item].hint}`,
            }))}
          />

          {category ? (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Keterangan:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {categoryMeta[category].hint}
              </span>
            </p>
          ) : null}

          {errors.category ? (
            <p
              id="category-error"
              className="mt-1.5 text-xs font-semibold text-[var(--danger)]"
            >
              {errors.category}
            </p>
          ) : null}
        </div>
      </section>

      {/* C. KETERANGAN TEMUAN */}
      <section
        aria-labelledby="section-description-title"
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="description"
            id="section-description-title"
            className="text-base font-bold text-[var(--foreground)]"
          >
            3. Apa yang Anda temukan? <span aria-hidden="true">*</span>
          </label>
          <div className="flex items-center gap-2">
            {aiFilledFields.description ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
                <Sparkles aria-hidden="true" className="size-3" />
                Draf AI · dapat diedit
              </span>
            ) : null}
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {singleLine(description).trim().length}/1000
            </span>
          </div>
        </div>
        <p
          id="description-help"
          className="mt-0.5 text-xs text-[var(--muted-foreground)]"
        >
          Jelaskan objek yang terlihat dan kondisinya secara singkat (10–1000
          karakter).
        </p>

        <textarea
          id="description"
          name="description"
          rows={3}
          required
          value={description}
          placeholder="Ada ban bekas berisi air di dekat tempat sampah. Lokasinya berada di sisi kiri gang."
          aria-describedby={
            errors.description
              ? "description-help description-error"
              : "description-help"
          }
          aria-invalid={Boolean(errors.description)}
          onChange={(event) => {
            resetAttemptKey();
            setDescription(event.target.value);
            setAiFilledFields((curr) => ({ ...curr, description: false }));
            setErrors((curr) => {
              const next = { ...curr };
              delete next.description;
              return next;
            });
          }}
          className={`${controlClass} mt-2.5`}
        />
        {errors.description ? (
          <p
            id="description-error"
            className="mt-1.5 text-xs font-semibold text-[var(--danger)]"
          >
            {errors.description}
          </p>
        ) : null}
      </section>

      {/* D. LOKASI TEMUAN */}
      <section
        aria-labelledby="section-location-title"
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      >
        <h2
          id="section-location-title"
          className="text-base font-bold text-[var(--foreground)]"
        >
          4. Lokasi temuan
        </h2>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          Bantu petugas dan kader menemukan titik lokasi dengan cepat di
          lapangan.
        </p>

        <div className="mt-3.5 grid gap-4">
          {/* Wilayah */}
          <div>
            <label
              htmlFor="areaId"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              Wilayah pelaporan <span aria-hidden="true">*</span>
            </label>
            <div className="mt-1.5">
              <CustomSelect
                id="areaId"
                name="areaId"
                value={areaId}
                size="md"
                placeholder="Pilih wilayah…"
                aria-invalid={Boolean(errors.areaId)}
                aria-describedby={errors.areaId ? "areaId-error" : undefined}
                onChange={(val) => {
                  resetAttemptKey();
                  setAreaId(val);
                }}
                options={areas.map((area) => ({
                  value: area.id,
                  label: area.name,
                }))}
              />
            </div>
            {errors.areaId ? (
              <p
                id="areaId-error"
                className="mt-1.5 text-xs font-semibold text-[var(--danger)]"
              >
                {errors.areaId}
              </p>
            ) : null}
          </div>

          {/* Patokan / Petunjuk lokasi */}
          <div>
            <label
              htmlFor="locationNote"
              className="block text-sm font-semibold text-[var(--foreground)]"
            >
              Patokan / petunjuk lokasi
            </label>
            <p
              id="locationNote-help"
              className="mt-0.5 text-xs text-[var(--muted-foreground)]"
            >
              Tulis patokan jalan, gang, atau bangunan terdekat (disarankan jika
              tidak menggunakan GPS).
            </p>
            <input
              id="locationNote"
              name="locationNote"
              type="text"
              maxLength={250}
              value={locationNote}
              placeholder="Contoh: Di belakang Mushola Al-Ikhlas, dekat tempat sampah RT 03"
              aria-describedby={
                errors.locationNote
                  ? "locationNote-help locationNote-error"
                  : "locationNote-help"
              }
              aria-invalid={Boolean(errors.locationNote)}
              onChange={(event) => {
                resetAttemptKey();
                setLocationNote(event.target.value);
              }}
              className={`${controlClass} mt-2`}
            />
            {errors.locationNote ? (
              <p
                id="locationNote-error"
                className="mt-1.5 text-xs font-semibold text-[var(--danger)]"
              >
                {errors.locationNote}
              </p>
            ) : null}
          </div>

          {/* Titik GPS opsional */}
          <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[var(--foreground)]">
                  Titik GPS perangkat (opsional)
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Gunakan tombol ini saat Anda sedang berada langsung di lokasi
                  temuan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={geoState === "loading"}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] disabled:opacity-60"
                >
                  <Navigation
                    aria-hidden="true"
                    className="size-3.5 text-[var(--primary)]"
                  />
                  {geoState === "loading"
                    ? "Mengambil lokasi..."
                    : coordinates
                      ? "Perbarui lokasi saya"
                      : "Gunakan lokasi saya"}
                </button>
                {coordinates ? (
                  <button
                    type="button"
                    onClick={() => {
                      resetAttemptKey();
                      setCoordinates(null);
                      setGeoState("idle");
                    }}
                    className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[var(--danger)] hover:underline"
                  >
                    <XCircle aria-hidden="true" className="size-3.5" />
                    Hapus titik
                  </button>
                ) : null}
              </div>
            </div>

            {coordinates ? (
              <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-[var(--primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                Titik GPS tersimpan ({coordinates.latitude.toFixed(5)},{" "}
                {coordinates.longitude.toFixed(5)} · akurasi ±
                {coordinates.accuracy} m)
              </p>
            ) : null}

            {geoState === "denied" ? (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Izin lokasi ditolak pada perangkat Anda. Anda tetap dapat
                mengirim laporan menggunakan patokan lokasi di atas.
              </p>
            ) : null}

            {geoState === "unavailable" ? (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Titik GPS belum dapat diambil saat ini. Anda tetap dapat
                mengirim laporan tanpa titik GPS.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* E. PENGIRIMAN */}
      <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Laporan akan diterima pengelola wilayah untuk diperiksa sebelum
          penugasan kader.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              <span>{uploadStep ?? "Mengirim laporan..."}</span>
            </>
          ) : (
            <span>Kirim laporan</span>
          )}
        </button>
      </div>
    </form>
  );
}
