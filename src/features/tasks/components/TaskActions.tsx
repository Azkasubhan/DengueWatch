"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  controlClass,
  postReportAction,
  reasonError,
  type ReportActionResult,
} from "@/features/reports/components/reportAction";
import type { TaskStatus } from "@/features/tasks/validation";

type Props = {
  taskId: string;
  status: TaskStatus;
  version: number;
  assignedToMe: boolean;
  pendingSubmittedByMe: boolean | null;
};

const openStatuses: TaskStatus[] = [
  "assigned",
  "in_progress",
  "awaiting_review",
  "reopened",
];

export function TaskActions({
  assignedToMe,
  pendingSubmittedByMe,
  status,
  taskId,
  version,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<{
    conflict: boolean;
    message: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const uploadRef = useRef<{ file: File; id: string } | null>(null);
  const [decision, setDecision] = useState<"approve" | "request_revision">(
    "approve",
  );
  const [reviewReason, setReviewReason] = useState("");
  const [closing, setClosing] = useState<"cancel" | "reopen" | null>(null);
  const [closeReason, setCloseReason] = useState("");

  const base = `/api/v1/tasks/${taskId}`;

  function settle(result: ReportActionResult, success: string) {
    if (result.kind === "ok") {
      setNotice(success);
      setErrors({});
      setDescription("");
      setFile(null);
      setReviewReason("");
      setCloseReason("");
      setClosing(null);
      uploadRef.current = null;
      router.refresh();
      return;
    }
    if (result.kind === "invalid" && Object.keys(result.fieldErrors).length) {
      setErrors(result.fieldErrors);
      return;
    }
    if (result.kind === "conflict") uploadRef.current = null;
    setFailure({
      conflict: result.kind === "conflict",
      message: result.message,
    });
  }

  async function run(
    key: string,
    action: () => Promise<ReportActionResult>,
    success: string,
  ) {
    setFailure(null);
    setNotice(null);
    setPending(key);
    const result = await action();
    setPending(null);
    settle(result, success);
  }

  async function uploadPhoto(photo: File): Promise<ReportActionResult> {
    if (uploadRef.current?.file === photo)
      return { kind: "ok", data: { id: uploadRef.current.id } };
    const form = new FormData();
    form.append("photo", photo);
    let response: Response;
    try {
      response = await fetch(`${base}/evidence-uploads`, {
        method: "POST",
        body: form,
      });
    } catch {
      return { kind: "error", message: "Koneksi terputus. Coba lagi." };
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      return {
        kind: response.status === 409 ? "conflict" : "error",
        message: payload?.error?.message ?? "Foto bukti belum dapat diunggah.",
      };
    uploadRef.current = { file: photo, id: payload.data.id };
    return { kind: "ok", data: { id: payload.data.id } };
  }

  async function submitEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!file) next["evidence-photo"] = "Pilih satu foto bukti.";
    const invalid = reasonError(description);
    if (invalid) next.description = invalid;
    setErrors(next);
    if (Object.keys(next).length || !file) {
      document
        .getElementById(
          next["evidence-photo"] ? "evidence-photo" : "description",
        )
        ?.focus();
      return;
    }
    await run(
      "evidence",
      async () => {
        const upload = await uploadPhoto(file);
        if (upload.kind !== "ok") return upload;
        return postReportAction(`${base}/evidence`, {
          uploadId: upload.data!.id,
          description: description.trim(),
          expectedVersion: version,
        });
      },
      "Bukti terkirim dan menunggu pemeriksaan kader lain.",
    );
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid =
      decision === "request_revision" || reviewReason.trim()
        ? reasonError(reviewReason)
        : null;
    setErrors(invalid ? { reason: invalid } : {});
    if (invalid) {
      document.getElementById("review-reason")?.focus();
      return;
    }
    await run(
      "review",
      () =>
        postReportAction(`${base}/review`, {
          decision,
          expectedVersion: version,
          ...(reviewReason.trim() ? { reason: reviewReason.trim() } : {}),
        }),
      decision === "approve"
        ? "Bukti disetujui. Tugas selesai."
        : "Permintaan perbaikan bukti terkirim.",
    );
  }

  async function submitClosing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = reasonError(closeReason);
    setErrors(invalid ? { closeReason: invalid } : {});
    if (invalid || !closing) {
      document.getElementById("close-reason")?.focus();
      return;
    }
    await run(
      closing,
      () =>
        postReportAction(`${base}/${closing}`, {
          reason: closeReason.trim(),
          expectedVersion: version,
        }),
      closing === "cancel" ? "Tugas dibatalkan." : "Tugas dibuka kembali.",
    );
  }

  const fieldError = (id: string) =>
    errors[id] ? (
      <p
        id={`${id}-error`}
        className="text-sm font-medium text-[var(--danger)]"
      >
        {errors[id]}
      </p>
    ) : null;
  const describedBy = (id: string, help?: string) =>
    [help, errors[id] ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;

  const canStart =
    assignedToMe && (status === "assigned" || status === "reopened");
  const canSubmit = assignedToMe && status === "in_progress";
  const canReview =
    status === "awaiting_review" && pendingSubmittedByMe === false;

  return (
    <section
      aria-labelledby="task-actions-title"
      className="grid gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
    >
      <h2 id="task-actions-title" className="text-xl font-bold">
        Tindakan
      </h2>
      <div aria-live="polite">
        {notice ? (
          <p className="rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4 font-semibold">
            {notice}
          </p>
        ) : null}
      </div>
      {failure ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
        >
          <p className="font-semibold text-[var(--danger)]">
            {failure.message}
          </p>
          {failure.conflict ? (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => {
                setFailure(null);
                router.refresh();
              }}
            >
              Muat data terbaru
            </Button>
          ) : null}
        </div>
      ) : null}

      {canStart ? (
        <div>
          <Button
            isLoading={pending === "start"}
            onClick={() =>
              run(
                "start",
                () =>
                  postReportAction(`${base}/start`, {
                    expectedVersion: version,
                  }),
                "Tugas mulai dikerjakan.",
              )
            }
          >
            Mulai kerjakan
          </Button>
        </div>
      ) : null}

      {canSubmit ? (
        <form noValidate onSubmit={submitEvidence} className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="evidence-photo" className="font-semibold">
              Foto bukti <span aria-hidden="true">*</span>
            </label>
            <input
              id="evidence-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-required="true"
              aria-invalid={Boolean(errors["evidence-photo"])}
              aria-describedby={describedBy(
                "evidence-photo",
                "evidence-photo-help",
              )}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                uploadRef.current = null;
              }}
              className={controlClass}
            />
            <p
              id="evidence-photo-help"
              className="text-sm text-[var(--muted-foreground)]"
            >
              Satu foto JPG, PNG, atau WebP, maksimal 5 MiB. Metadata lokasi
              dihapus otomatis dan foto disimpan privat.
            </p>
            {fieldError("evidence-photo")}
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="font-semibold">
              Catatan bukti <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="description"
              rows={3}
              maxLength={500}
              value={description}
              aria-required="true"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={describedBy("description", "description-help")}
              onChange={(event) => setDescription(event.target.value)}
              className={controlClass}
            />
            <p
              id="description-help"
              className="text-sm text-[var(--muted-foreground)]"
            >
              10–500 karakter. Jelaskan tindakan yang sudah dilakukan.
            </p>
            {fieldError("description")}
          </div>
          <div>
            <Button type="submit" isLoading={pending === "evidence"}>
              Kirim bukti
            </Button>
          </div>
        </form>
      ) : null}

      {status === "awaiting_review" && pendingSubmittedByMe ? (
        <p className="rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
          Bukti Anda menunggu pemeriksaan kader lain. Pengirim bukti tidak dapat
          menyetujui buktinya sendiri.
        </p>
      ) : null}

      {canReview ? (
        <form noValidate onSubmit={submitReview} className="grid gap-4">
          <fieldset className="grid gap-3">
            <legend className="mb-2 font-semibold">Pemeriksaan bukti</legend>
            {(
              [
                ["approve", "Setujui bukti", "Tugas dinyatakan selesai."],
                [
                  "request_revision",
                  "Minta perbaikan",
                  "Tugas kembali dikerjakan.",
                ],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer gap-3 rounded-[var(--radius-control)] border border-[var(--border)] p-4 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-subtle)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--primary)]"
              >
                <input
                  type="radio"
                  name="evidence-decision"
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                  className="mt-1 size-4 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-[var(--muted-foreground)]">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-2">
            <label htmlFor="review-reason" className="font-semibold">
              {decision === "request_revision"
                ? "Alasan"
                : "Catatan (opsional)"}
              {decision === "request_revision" ? (
                <span aria-hidden="true"> *</span>
              ) : null}
            </label>
            <textarea
              id="review-reason"
              rows={3}
              maxLength={500}
              value={reviewReason}
              aria-required={decision === "request_revision"}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={describedBy("reason", "review-reason-help")}
              onChange={(event) => setReviewReason(event.target.value)}
              className={controlClass}
            />
            <p
              id="review-reason-help"
              className="text-sm text-[var(--muted-foreground)]"
            >
              10–500 karakter. Wajib saat meminta perbaikan.
            </p>
            {fieldError("reason")}
          </div>
          <div>
            <Button type="submit" isLoading={pending === "review"}>
              Simpan pemeriksaan
            </Button>
          </div>
        </form>
      ) : null}

      {openStatuses.includes(status) || status === "completed" ? (
        <div className="grid gap-3 border-t border-[var(--border)] pt-5">
          {closing ? (
            <form noValidate onSubmit={submitClosing} className="grid gap-3">
              <label htmlFor="close-reason" className="font-semibold">
                {closing === "cancel"
                  ? "Alasan pembatalan"
                  : "Alasan membuka kembali"}{" "}
                <span aria-hidden="true">*</span>
              </label>
              <textarea
                id="close-reason"
                rows={3}
                maxLength={500}
                value={closeReason}
                aria-required="true"
                aria-invalid={Boolean(errors.closeReason)}
                aria-describedby={describedBy(
                  "closeReason",
                  "close-reason-help",
                )}
                onChange={(event) => setCloseReason(event.target.value)}
                className={controlClass}
              />
              <p
                id="close-reason-help"
                className="text-sm text-[var(--muted-foreground)]"
              >
                10–500 karakter. Alasan tercatat pada riwayat.
              </p>
              {fieldError("closeReason")}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  variant={closing === "cancel" ? "danger" : "primary"}
                  isLoading={pending === closing}
                >
                  {closing === "cancel" ? "Batalkan tugas" : "Buka kembali"}
                </Button>
                <Button variant="ghost" onClick={() => setClosing(null)}>
                  Batal
                </Button>
              </div>
            </form>
          ) : status === "completed" ? (
            <div>
              <Button variant="secondary" onClick={() => setClosing("reopen")}>
                Buka kembali tugas
              </Button>
            </div>
          ) : (
            <div>
              <Button variant="secondary" onClick={() => setClosing("cancel")}>
                Batalkan tugas
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
