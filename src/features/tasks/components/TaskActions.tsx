"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import {
  controlClass,
  postReportAction,
  reasonError,
  type ReportActionResult,
} from "@/features/reports/components/reportAction";
import type { EvidenceStatus } from "@/features/tasks/data";
import type { TaskStatus } from "@/features/tasks/validation";

type Props = {
  role: "cadre" | "manager";
  taskId: string;
  status: TaskStatus;
  version: number;
  /** The signed-in cadre's progress in the current round; null when not an assignee. */
  myEvidenceStatus: EvidenceStatus | null;
  pendingEvidence: { id: string; submitterName: string }[];
};

const openStatuses: TaskStatus[] = [
  "assigned",
  "in_progress",
  "awaiting_review",
  "reopened",
];

// T27/T33: assigned cadres start tasks and each submits their own evidence; managers
// review each submission and cancel or reopen tasks. Every rule is re-checked by the RPCs.
export function TaskActions({
  role,
  myEvidenceStatus,
  pendingEvidence,
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
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const reviewed =
    pendingEvidence.find((item) => item.id === evidenceId) ??
    pendingEvidence[0];
  const [closing, setClosing] = useState<"cancel" | "reopen" | null>(null);
  const [closeReason, setCloseReason] = useState("");

  const base = `/api/v1/tasks/${taskId}`;

  type Success = string | ((data: { status?: string } | undefined) => string);

  function settle(result: ReportActionResult, success: Success) {
    if (result.kind === "ok") {
      const msg = typeof success === "string" ? success : success(result.data);
      setNotice(msg);
      toast.success(msg);
      setErrors({});
      setDescription("");
      setFile(null);
      setReviewReason("");
      setEvidenceId(null);
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
    success: Success,
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
      "Bukti terkirim dan menunggu pemeriksaan pengelola.",
    );
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid =
      decision === "request_revision" || reviewReason.trim()
        ? reasonError(reviewReason)
        : null;
    setErrors(invalid ? { reason: invalid } : {});
    if (invalid || !reviewed) {
      document.getElementById("review-reason")?.focus();
      return;
    }
    const name = reviewed.submitterName;
    await run(
      "review",
      () =>
        postReportAction(`${base}/review`, {
          evidenceId: reviewed.id,
          decision,
          expectedVersion: version,
          ...(reviewReason.trim() ? { reason: reviewReason.trim() } : {}),
        }),
      (data) =>
        decision === "request_revision"
          ? `Permintaan perbaikan terkirim ke ${name}.`
          : data?.status === "completed"
            ? "Bukti disetujui. Bukti semua kader lengkap, tugas selesai."
            : `Bukti ${name} disetujui. Tugas selesai setelah bukti semua kader disetujui.`,
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

  const cadre = role === "cadre";
  const canStart = cadre && (status === "assigned" || status === "reopened");
  const working = status === "in_progress" || status === "awaiting_review";
  // T33: each cadre submits once per round, again only after a revision request.
  const canSubmit =
    cadre &&
    working &&
    (myEvidenceStatus === "missing" ||
      myEvidenceStatus === "revision_required");
  const canReview = !cadre && status === "awaiting_review" && Boolean(reviewed);
  const canClose =
    !cadre && (openStatuses.includes(status) || status === "completed");
  // Explains whose turn it is when this role has nothing to do right now.
  const waitingNote = cadre
    ? working
      ? {
          pending: "Bukti Anda menunggu pemeriksaan pengelola.",
          approved:
            "Bukti Anda sudah disetujui. Tugas selesai setelah bukti semua kader disetujui.",
        }[myEvidenceStatus as string]
      : {
          completed:
            "Tugas selesai. Bukti semua kader telah disetujui pengelola.",
          cancelled: "Tugas dibatalkan pengelola.",
        }[status as string]
    : {
        assigned: "Menunggu kader memulai tugas.",
        reopened: "Tugas dibuka kembali dan menunggu kader memulainya lagi.",
        in_progress:
          "Menunggu kader mengirim bukti. Setiap kader pelaksana wajib mengirim buktinya sendiri.",
        cancelled: "Tugas dibatalkan.",
      }[status as string];

  return (
    <section
      aria-labelledby="task-actions-title"
      className="grid gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <h2 id="task-actions-title" className="text-lg font-bold">
        Tindakan
      </h2>
      <div aria-live="polite" className="empty:sr-only">
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
        <form
          noValidate
          onSubmit={submitEvidence}
          className="grid gap-4 rounded-[var(--radius-control)] bg-[var(--background)] p-3 sm:p-4 [&>*]:min-w-0"
        >
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
          <div className="flex sm:justify-end">
            <Button type="submit" isLoading={pending === "evidence"}>
              Kirim bukti
            </Button>
          </div>
        </form>
      ) : null}

      {waitingNote ? (
        <p className="rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
          {waitingNote}
        </p>
      ) : null}

      {canReview ? (
        <form
          noValidate
          onSubmit={submitReview}
          className="grid gap-4 rounded-[var(--radius-control)] bg-[var(--background)] p-3 sm:p-4 [&>*]:min-w-0"
        >
          {pendingEvidence.length > 1 ? (
            <fieldset className="grid gap-3">
              <legend className="mb-2 font-semibold">
                Bukti yang diperiksa
              </legend>
              {pendingEvidence.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border)] px-4 py-2 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-subtle)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--primary)]"
                >
                  <input
                    type="radio"
                    name="evidence-target"
                    value={item.id}
                    checked={reviewed?.id === item.id}
                    onChange={() => setEvidenceId(item.id)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 break-words">
                    {item.submitterName}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <fieldset className="grid gap-3">
            <legend className="mb-2 font-semibold">
              Pemeriksaan bukti {reviewed?.submitterName}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    "approve",
                    "Setujui bukti",
                    "Tugas selesai setelah bukti semua kader disetujui.",
                  ],
                  [
                    "request_revision",
                    "Minta perbaikan",
                    "Kader ini mengirim ulang buktinya.",
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
            </div>
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
          <div className="flex sm:justify-end">
            <Button type="submit" isLoading={pending === "review"}>
              Simpan pemeriksaan
            </Button>
          </div>
        </form>
      ) : null}

      {canClose ? (
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
                {closing === "cancel"
                  ? " Tugas yang dibatalkan tidak dapat dibuka kembali; buat tugas baru bila diperlukan."
                  : ""}
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
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => setClosing("cancel")}>
                Batalkan tugas
              </Button>
              <p className="text-sm text-[var(--muted-foreground)]">
                Hanya bila tugas tidak lagi relevan. Alasan tercatat pada
                riwayat.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
