"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createReportSchema,
  reportCategoryLabels,
} from "@/features/reports/validation";
import { Button } from "@/components/ui/Button";

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
    setPhotos(next.map((file) => ({ file, url: URL.createObjectURL(file) })));
    setUploadedIds([]);
    setPreview(false);
    setRequestKey(crypto.randomUUID());
    setFieldErrors((old) => ({ ...old, photos: "" }));
  }

  function removePhoto(index: number) {
    if (uploadedIds[index]) releaseUploads([uploadedIds[index]]);
    setPhotos((old) => old.filter((_, i) => i !== index));
    setUploadedIds((old) => old.filter((_, i) => i !== index));
    setPreview(false);
    setRequestKey(crypto.randomUUID());
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
    if (busy || !validate()) return;
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
    "min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";
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
    <div className="grid max-w-2xl gap-7">
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
        <>
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
              Pilih 1–3 foto JPG, PNG, atau WebP, masing-masing maksimal 5 MiB.
              Pilihan baru mengganti foto sebelumnya. Hindari wajah, plat
              kendaraan, dan alamat rumah.
            </p>
            {fieldError("photos")}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    className="aspect-square w-full rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="mt-2 min-h-11 w-full text-sm font-semibold text-[var(--danger)] focus-visible:outline-2"
                  >
                    Hapus foto {index + 1}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="areaId" className="text-sm font-semibold">
              Wilayah <span aria-hidden="true">*</span>
            </label>
            <select
              id="areaId"
              value={areaId}
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.areaId)}
              aria-describedby={fieldErrors.areaId ? "areaId-error" : undefined}
              onChange={(event) => {
                setAreaId(event.target.value);
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
                setRequestKey(crypto.randomUUID());
              }}
              className={control}
            >
              <option value="">Pilih kategori</option>
              {Object.entries(reportCategoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {fieldError("category")}
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-semibold">
              Deskripsi lingkungan <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              aria-required="true"
              onChange={(event) => {
                setDescription(event.target.value);
                setRequestKey(crypto.randomUUID());
              }}
              maxLength={1000}
              rows={5}
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
          <div className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] p-4">
            <p className="font-semibold">Lokasi titik (opsional)</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Titik presisi hanya terlihat oleh Anda dan petugas yang berwenang.
              Anda dapat melapor tanpa memberikan lokasi perangkat.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={useLocation}>
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
            {coordinates ? (
              <p className="text-sm">
                Titik dipilih. Koordinat tidak ditampilkan pada halaman publik.
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
              placeholder="Contoh: dekat saluran umum"
            />
            {fieldError("location")}
          </div>
          <Button
            type="button"
            onClick={() => {
              if (validate()) setPreview(true);
            }}
          >
            Tinjau laporan
          </Button>
        </>
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
              ? "Titik lokasi privat disertakan"
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
