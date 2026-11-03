"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createReportSchema,
  reportCategoryLabels,
} from "@/features/reports/validation";
import { Button } from "@/components/ui/Button";
import { AiSuggestionDetails } from "@/features/ai/components/AiSuggestionDetails";
import {
  aiReportSuggestionSchema,
  type AiReportSuggestion,
} from "@/features/ai/schema";

type Area = { id: string; name: string; isDemo: boolean };
type LocalPhoto = { file: File; url: string };

export function ReportForm({ areas }: { areas: Area[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [category, setCategory] = useState<
    keyof typeof reportCategoryLabels | ""
  >("");
  const [description, setDescription] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const focusErrorsRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);
  const [aiStage, setAiStage] = useState<
    | "idle"
    | "preparing"
    | "loading"
    | "success"
    | "unavailable"
    | "invalid"
    | "rate"
    | "cancelled"
  >("idle");
  const [aiMessage, setAiMessage] = useState("");
  const [suggestion, setSuggestion] = useState<AiReportSuggestion | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  // Marks fields copied from the AI suggestion until the resident edits them.
  const [aiFilled, setAiFilled] = useState(false);
  const [restoreValues, setRestoreValues] = useState<{
    category: typeof category;
    description: string;
  } | null>(null);
  const aiControllerRef = useRef<AbortController | null>(null);
  const aiGenerationRef = useRef(0);
  const manualRevisionRef = useRef(0);

  useEffect(
    () => () => {
      for (const photo of photos) URL.revokeObjectURL(photo.url);
    },
    [photos],
  );

  useEffect(() => {
    if (!focusErrorsRef.current || !errorSummaryRef.current) return;
    errorSummaryRef.current.focus();
    focusErrorsRef.current = false;
  }, [fieldErrors, preview]);

  useEffect(() => () => aiControllerRef.current?.abort(), []);

  function invalidateAi() {
    aiGenerationRef.current += 1;
    aiControllerRef.current?.abort();
    aiControllerRef.current = null;
    setAiStage("idle");
    setAiMessage("");
    setSuggestion(null);
    setConfirmApply(false);
    setRestoreValues(null);
  }

  function releaseUploads(ids: string[]) {
    void Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/v1/report-uploads/${id}`, { method: "DELETE" }),
      ),
    );
  }

  function changePhotos(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files);
    if (next.length < 1 || next.length > 3) {
      setFieldErrors((old) => ({ ...old, photos: "Pilih 1–3 foto." }));
      return;
    }
    if (
      next.some(
        (file) =>
          file.size > 5 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setFieldErrors((old) => ({
        ...old,
        photos: "Setiap foto harus JPG, PNG, atau WebP, maksimal 5 MiB.",
      }));
      return;
    }
    releaseUploads(uploadedIds);
    invalidateAi();
    setPhotos(next.map((file) => ({ file, url: URL.createObjectURL(file) })));
    setUploadedIds([]);
    setPreview(false);
    setRequestKey(crypto.randomUUID());
    setFieldErrors((old) => ({ ...old, photos: "" }));
  }

  function removePhoto(index: number) {
    invalidateAi();
    if (uploadedIds[index]) releaseUploads([uploadedIds[index]]);
    setPhotos((old) => old.filter((_, i) => i !== index));
    setUploadedIds((old) => old.filter((_, i) => i !== index));
    setPreview(false);
    setRequestKey(crypto.randomUUID());
  }

  async function preparePrimaryPhoto() {
    if (!photos[0] || uploadedIds[0] || busy || aiStage === "preparing") return;
    setAiStage("preparing");
    setAiMessage("");
    const generation = aiGenerationRef.current;
    const body = new FormData();
    body.append("photo", photos[0].file);
    try {
      const response = await fetch("/api/v1/report-uploads", {
        method: "POST",
        body,
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.id !== "string")
        throw new Error(
          payload.error?.message ?? "Foto belum dapat disiapkan.",
        );
      if (generation !== aiGenerationRef.current) {
        releaseUploads([payload.id]);
        return;
      }
      setUploadedIds((current) => [payload.id, ...current.slice(1)]);
      setAiStage("idle");
    } catch (cause) {
      if (generation !== aiGenerationRef.current) return;
      setAiStage("unavailable");
      setAiMessage(
        cause instanceof Error ? cause.message : "Foto belum dapat disiapkan.",
      );
    }
  }

  async function requestAi() {
    if (!uploadedIds[0] || !areaId || busy || aiStage === "loading") return;
    const controller = new AbortController();
    aiControllerRef.current = controller;
    const generation = aiGenerationRef.current;
    const revision = manualRevisionRef.current;
    setAiStage("loading");
    setAiMessage("");
    setSuggestion(null);
    setConfirmApply(false);
    try {
      const response = await fetch("/api/v1/ai/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId, uploadId: uploadedIds[0] }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (generation !== aiGenerationRef.current) return;
      if (!response.ok) {
        const code = payload.error?.code;
        setAiStage(
          code === "RATE_LIMIT"
            ? "rate"
            : code === "AI_INVALID_OUTPUT"
              ? "invalid"
              : "unavailable",
        );
        setAiMessage(
          payload.error?.message ??
            "Analisis AI tidak tersedia. Anda tetap dapat melanjutkan laporan secara manual.",
        );
        return;
      }
      const parsed = aiReportSuggestionSchema.safeParse(
        payload.data?.suggestion,
      );
      if (!parsed.success || revision !== manualRevisionRef.current) {
        setAiStage("invalid");
        setAiMessage(
          revision !== manualRevisionRef.current
            ? "Isian berubah saat analisis berjalan. Minta saran baru bila diperlukan."
            : "Saran AI tidak valid. Anda tetap dapat melanjutkan laporan secara manual.",
        );
        return;
      }
      setSuggestion(parsed.data);
      setAiStage("success");
    } catch {
      if (generation !== aiGenerationRef.current) return;
      setAiStage(controller.signal.aborted ? "cancelled" : "unavailable");
      setAiMessage(
        controller.signal.aborted
          ? "Analisis dibatalkan. Isian Anda tetap tersedia."
          : "Analisis AI tidak tersedia. Anda tetap dapat melanjutkan laporan secara manual.",
      );
    } finally {
      if (aiControllerRef.current === controller)
        aiControllerRef.current = null;
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (!confirmApply && (category || description)) {
      setConfirmApply(true);
      return;
    }
    setRestoreValues({ category, description });
    setCategory(suggestion.suggestedCategory);
    setDescription(suggestion.draftDescription);
    setRequestKey(crypto.randomUUID());
    setConfirmApply(false);
    setAiFilled(true);
    setAiMessage(
      "Saran disalin ke formulir. Periksa dan ubah sebelum mengirim.",
    );
    requestAnimationFrame(() =>
      document.getElementById("description")?.focus(),
    );
  }

  function validate() {
    const result = createReportSchema.safeParse({
      areaId,
      category,
      description,
      imageUploadIds: photos.map(() => crypto.randomUUID()),
      location:
        coordinates || locationNote
          ? {
              latitude: coordinates?.latitude ?? null,
              longitude: coordinates?.longitude ?? null,
              note: locationNote,
            }
          : null,
    });
    const errors: Record<string, string> = {};
    if (!photos.length) errors.photos = "Tambahkan minimal satu foto.";
    if (!result.success)
      for (const issue of result.error.issues)
        errors[issue.path[0]?.toString() ?? "form"] ??= issue.message;
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setPreview(false);
      focusErrorsRef.current = true;
    }
    return Object.keys(errors).length === 0;
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setError("Perangkat ini tidak menyediakan lokasi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Math.round(coords.accuracy),
        });
        setRequestKey(crypto.randomUUID());
        setError("");
      },
      () =>
        setError(
          "Lokasi tidak digunakan. Anda tetap dapat mengirim laporan tanpa titik lokasi.",
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }

  async function submit() {
    if (busy || aiStage === "preparing" || aiStage === "loading" || !validate())
      return;
    setBusy(true);
    setError("");
    const ids = [...uploadedIds];
    try {
      if (ids.length < photos.length) {
        for (let i = ids.length; i < photos.length; i++) {
          setProgress(`Mengunggah foto ${i + 1} dari ${photos.length}…`);
          const body = new FormData();
          body.append("photo", photos[i]!.file);
          const response = await fetch("/api/v1/report-uploads", {
            method: "POST",
            body,
          });
          const payload = await response.json();
          if (!response.ok)
            throw new Error(
              payload.error?.message ?? "Foto belum dapat diunggah.",
            );
          ids.push(payload.id);
          setUploadedIds([...ids]);
        }
      }
      setProgress("Menyimpan laporan…");
      const response = await fetch("/api/v1/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey,
        },
        body: JSON.stringify({
          areaId,
          category,
          description,
          imageUploadIds: ids,
          location:
            coordinates || locationNote
              ? {
                  latitude: coordinates?.latitude ?? null,
                  longitude: coordinates?.longitude ?? null,
                  note: locationNote,
                }
              : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.error?.fieldErrors) {
          const serverErrors: Record<string, string> = {};
          for (const [path, message] of Object.entries(
            payload.error.fieldErrors as Record<string, string>,
          )) {
            const field = path.split(".")[0] ?? "form";
            const target = field === "imageUploadIds" ? "photos" : field;
            serverErrors[target] ??= message;
          }
          setFieldErrors(serverErrors);
          setPreview(false);
          focusErrorsRef.current = true;
        }
        throw new Error(
          payload.error?.message ?? "Laporan belum dapat disimpan.",
        );
      }
      router.push(`/app/laporan/${payload.data.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Laporan belum dapat disimpan.",
      );
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  const control =
    "min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] px-3.5 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`${name}-error`} className="text-sm text-[var(--danger)]">
        {fieldErrors[name]}
      </p>
    ) : null;
  const activeErrors = Object.entries(fieldErrors).filter(([, message]) =>
    Boolean(message),
  );
  const errorTargets: Record<string, string> = {
    photos: "photos",
    imageUploadIds: "photos",
    areaId: "areaId",
    category: "category",
    description: "description",
    location: "locationNote",
  };

  return (
    <div className={`grid gap-7 ${preview ? "max-w-3xl" : ""}`}>
      {activeErrors.length ? (
        <div
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
          aria-labelledby="report-errors-title"
          className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
        >
          <h2 id="report-errors-title" className="font-semibold">
            Periksa isian berikut
          </h2>
          <ul className="mt-2 list-disc pl-5">
            {activeErrors.map(([name, message]) => (
              <li key={name}>
                <a
                  href={`#${errorTargets[name] ?? "description"}`}
                  className="text-[var(--danger)] underline underline-offset-2 focus-visible:outline-2"
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      {!preview ? (
        <div className="grid gap-7 lg:grid-cols-12 lg:items-start">
          <div className="grid gap-6 lg:col-span-5">
            <div className="grid gap-2">
              <p id="photos-label" className="text-sm font-semibold">
                Foto lingkungan <span aria-hidden="true">*</span>
              </p>
              <input
                id="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  changePhotos(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
                aria-labelledby="photos-label"
                aria-required="true"
                aria-describedby="photos-help photos-selected photos-error"
                aria-invalid={Boolean(fieldErrors.photos)}
                className="peer sr-only"
              />
              <label
                htmlFor="photos"
                className="inline-flex min-h-11 w-fit cursor-pointer items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]"
              >
                {photos.length ? "Ganti pilihan foto" : "Pilih foto"}
              </label>
              <p
                id="photos-selected"
                aria-live="polite"
                className="text-sm text-[var(--muted-foreground)]"
              >
                {photos.length
                  ? `${photos.length} foto dipilih`
                  : "Belum ada foto dipilih"}
              </p>
              <p
                id="photos-help"
                className="text-sm text-[var(--muted-foreground)]"
              >
                Pilih 1–3 foto JPG, PNG, atau WebP, masing-masing maksimal 5
                MiB. Pilihan baru mengganti foto sebelumnya. Hindari wajah, plat
                kendaraan, dan alamat rumah.
              </p>
              {fieldError("photos")}
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, index) => (
                  <div
                    key={photo.url}
                    className="rounded-[var(--radius-control)] border border-[var(--border)] p-2"
                  >
                    {/* Image is a local blob preview; the server creates normalized private copies. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Pratinjau foto ${index + 1}`}
                      className="aspect-[4/3] w-full rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="mt-1 min-h-11 w-full text-sm font-semibold text-[var(--danger)] focus-visible:outline-2"
                    >
                      Hapus foto {index + 1}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {photos.length ? (
              <section
                aria-labelledby="ai-heading"
                className="grid gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
              >
                <div className="grid gap-1">
                  <h2 id="ai-heading" className="text-lg font-semibold">
                    Bantuan Gemini (opsional)
                  </h2>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Foto pertama dianalisis layanan AI eksternal untuk menyusun
                    draf. Lokasi dan data akun tidak dikirim ke Gemini. Hasilnya
                    saran yang perlu Anda periksa.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {!uploadedIds[0] ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || aiStage === "preparing"}
                      onClick={preparePrimaryPhoto}
                    >
                      {aiStage === "preparing"
                        ? "Menyiapkan foto…"
                        : "Siapkan foto untuk AI"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || aiStage === "loading"}
                      onClick={requestAi}
                    >
                      {aiStage === "loading"
                        ? "Menganalisis…"
                        : "Bantu dengan Gemini"}
                    </Button>
                  )}
                  {aiStage === "loading" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        aiGenerationRef.current += 1;
                        aiControllerRef.current?.abort();
                        setAiStage("cancelled");
                        setAiMessage(
                          "Analisis dibatalkan. Isian Anda tetap tersedia.",
                        );
                      }}
                    >
                      Batalkan analisis
                    </Button>
                  ) : null}
                </div>
                {aiStage === "preparing" || aiStage === "loading" ? (
                  <p role="status" aria-live="polite" className="text-sm">
                    {aiStage === "preparing"
                      ? "Foto sedang divalidasi dan disimpan privat…"
                      : "Gemini sedang menyiapkan saran. Anda tetap dapat mengisi laporan."}
                  </p>
                ) : null}
                {aiMessage ? (
                  <p
                    role={
                      aiStage === "unavailable" ||
                      aiStage === "invalid" ||
                      aiStage === "rate"
                        ? "alert"
                        : "status"
                    }
                    className="text-sm text-[var(--muted-foreground)]"
                  >
                    {aiMessage}
                  </p>
                ) : null}
                {suggestion && aiStage === "success" ? (
                  <div
                    className="grid gap-3 border-t border-[var(--border)] pt-4"
                    aria-labelledby="ai-result-heading"
                  >
                    <h3 id="ai-result-heading" className="font-semibold">
                      Saran AI — perlu verifikasi
                    </h3>
                    <AiSuggestionDetails
                      category={suggestion.suggestedCategory}
                      visibleObjects={suggestion.visibleObjects}
                      draftDescription={suggestion.draftDescription}
                      precaution={suggestion.suggestedPrecaution}
                      limitations={suggestion.limitations}
                    />
                    {confirmApply ? (
                      <div
                        role="alert"
                        className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--border)] p-3"
                      >
                        <p className="text-sm">
                          Kategori atau deskripsi saat ini sudah terisi. Ganti
                          dengan saran AI? Isian lama dapat dipulihkan segera
                          setelahnya.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" onClick={applySuggestion}>
                            Ya, ganti isian
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setConfirmApply(false)}
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={applySuggestion}>
                          Terapkan saran ke formulir
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setSuggestion(null);
                            setAiStage("idle");
                            setAiMessage(
                              "Saran diabaikan. Isian manual tetap tersedia.",
                            );
                          }}
                        >
                          Abaikan saran
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Anda dapat mengubah kategori dan deskripsi setelah
                      menerapkan saran. Laporan tidak dikirim otomatis.
                    </p>
                  </div>
                ) : null}
                {restoreValues ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCategory(restoreValues.category);
                      setDescription(restoreValues.description);
                      setRestoreValues(null);
                      setAiFilled(false);
                      setRequestKey(crypto.randomUUID());
                      setAiMessage("Isian sebelumnya dipulihkan.");
                    }}
                  >
                    Pulihkan isian sebelumnya
                  </Button>
                ) : null}
              </section>
            ) : null}
          </div>
          <div className="grid gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="areaId" className="text-sm font-semibold">
                  Wilayah <span aria-hidden="true">*</span>
                </label>
                <select
                  id="areaId"
                  value={areaId}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.areaId)}
                  aria-describedby={
                    fieldErrors.areaId ? "areaId-error" : undefined
                  }
                  onChange={(event) => {
                    setAreaId(event.target.value);
                    invalidateAi();
                    setRequestKey(crypto.randomUUID());
                  }}
                  className={control}
                >
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                      {area.isDemo && !area.name.includes("(Simulasi)")
                        ? " (Simulasi)"
                        : ""}
                    </option>
                  ))}
                </select>
                {fieldError("areaId")}
              </div>
              <div className="grid gap-2">
                <label htmlFor="category" className="text-sm font-semibold">
                  Kategori temuan <span aria-hidden="true">*</span>
                  {aiFilled ? (
                    <span className="ml-2 rounded-full bg-[var(--info-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--info)]">
                      Diisi dari saran AI · bisa diubah
                    </span>
                  ) : null}
                </label>
                <select
                  id="category"
                  value={category}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-describedby={
                    fieldErrors.category ? "category-error" : undefined
                  }
                  onChange={(event) => {
                    setCategory(event.target.value as typeof category);
                    manualRevisionRef.current += 1;
                    setRestoreValues(null);
                    setAiFilled(false);
                    setRequestKey(crypto.randomUUID());
                  }}
                  className={control}
                >
                  <option value="">Pilih kategori</option>
                  {Object.entries(reportCategoryLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                {fieldError("category")}
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-semibold">
                Deskripsi lingkungan <span aria-hidden="true">*</span>
                {aiFilled ? (
                  <span className="ml-2 rounded-full bg-[var(--info-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--info)]">
                    Diisi dari saran AI · bisa diubah
                  </span>
                ) : null}
              </label>
              <textarea
                id="description"
                value={description}
                aria-required="true"
                onChange={(event) => {
                  setDescription(event.target.value);
                  manualRevisionRef.current += 1;
                  setRestoreValues(null);
                  setAiFilled(false);
                  setRequestKey(crypto.randomUUID());
                }}
                maxLength={1000}
                rows={3}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby="description-help description-error"
                className={control}
                placeholder="Jelaskan objek dan kondisinya tanpa menyebut identitas penghuni."
              />
              <p
                id="description-help"
                className="text-sm text-[var(--muted-foreground)]"
              >
                10–1000 karakter. Deskripsikan yang terlihat, tanpa diagnosis.
              </p>
              {fieldError("description")}
            </div>
            <div className="grid gap-3 rounded-[var(--radius-control)] bg-[var(--background)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Lokasi titik (opsional)</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Hanya terlihat oleh Anda dan petugas berwenang.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={useLocation}
                  >
                    Gunakan lokasi perangkat
                  </Button>
                  {coordinates ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setCoordinates(null);
                        setRequestKey(crypto.randomUUID());
                      }}
                    >
                      Hapus titik
                    </Button>
                  ) : null}
                </div>
              </div>
              {coordinates ? (
                <p className="text-sm" role="status">
                  Titik GPS tersimpan · akurasi sekitar ±
                  {coordinates.accuracy.toLocaleString("id-ID")} m.
                  {coordinates.accuracy > 100
                    ? " Titik ini kurang tepat; tambahkan petunjuk lokasi agar kader mudah menemukannya."
                    : ""}
                </p>
              ) : null}
              <label htmlFor="locationNote" className="text-sm font-semibold">
                Petunjuk lokasi umum (opsional)
              </label>
              <input
                id="locationNote"
                value={locationNote}
                aria-invalid={Boolean(fieldErrors.location)}
                aria-describedby={
                  fieldErrors.location ? "location-error" : undefined
                }
                onChange={(event) => {
                  setLocationNote(event.target.value);
                  setRequestKey(crypto.randomUUID());
                }}
                maxLength={250}
                className={control}
                placeholder="Contoh: gang sebelah masjid, dekat pos ronda"
              />
              {fieldError("location")}
            </div>
            <Button
              type="button"
              className="sm:justify-self-end"
              onClick={() => {
                if (validate()) setPreview(true);
              }}
            >
              Tinjau laporan
            </Button>
          </div>
        </div>
      ) : (
        <section
          className="grid gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
          aria-labelledby="preview-title"
        >
          <h2 id="preview-title" className="text-2xl font-bold">
            Tinjau sebelum kirim
          </h2>
          <p>
            <span className="font-semibold">Wilayah:</span>{" "}
            {areas.find((area) => area.id === areaId)?.name}
          </p>
          <p>
            <span className="font-semibold">Kategori:</span>{" "}
            {category ? reportCategoryLabels[category] : ""}
          </p>
          <p className="whitespace-pre-wrap break-words">
            <span className="font-semibold">Deskripsi:</span> {description}
          </p>
          <p>
            <span className="font-semibold">Lokasi:</span>{" "}
            {coordinates
              ? `Titik GPS disertakan (akurasi ±${coordinates.accuracy.toLocaleString("id-ID")} m)`
              : "Tanpa titik lokasi"}
            {locationNote ? ` — ${locationNote}` : ""}
          </p>
          <p>
            <span className="font-semibold">Foto:</span> {photos.length}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <div key={photo.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`Pratinjau foto ${index + 1}`}
                  className="aspect-square w-full rounded object-cover"
                />
              </div>
            ))}
          </div>
          <p className="rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4 text-sm">
            Foto disimpan privat dan hanya dapat dibaca oleh Anda serta petugas
            yang berwenang. Metadata lokasi perangkat pada foto dihapus. Laporan
            ini adalah temuan lingkungan, bukan diagnosis DBD.
          </p>
          {error ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Isian Anda tetap tersedia. Perbaiki laporan atau coba kirim lagi.
            </p>
          ) : null}
          {progress ? (
            <p role="status" aria-live="polite">
              {progress}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setPreview(false)}
            >
              Ubah laporan
            </Button>
            <Button type="button" disabled={busy} onClick={submit}>
              {busy ? "Mengirim…" : "Konfirmasi dan kirim"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
