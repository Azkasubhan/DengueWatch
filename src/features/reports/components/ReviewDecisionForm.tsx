"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  controlClass,
  postReportAction,
  reasonError,
} from "@/features/reports/components/reportAction";

type Decision = "verify" | "request_information" | "reject" | "duplicate";

const decisions: { value: Decision; label: string; hint: string }[] = [
  {
    value: "verify",
    label: "Verifikasi",
    hint: "Temuan sesuai dan perlu ditindaklanjuti.",
  },
  {
    value: "request_information",
    label: "Minta informasi",
    hint: "Warga perlu menambahkan keterangan.",
  },
  {
    value: "reject",
    label: "Tolak",
    hint: "Temuan tidak sesuai kriteria laporan.",
  },
  {
    value: "duplicate",
    label: "Tandai duplikat",
    hint: "Objek sama dengan laporan yang lebih awal.",
  },
];

export type DuplicateCandidate = {
  id: string;
  label: string;
};

export function ReviewDecisionForm({
  candidates,
  expectedVersion,
  reportId,
}: {
  candidates: DuplicateCandidate[];
  expectedVersion: number;
  reportId: string;
}) {
  const router = useRouter();
  const decisionRef = useRef<HTMLFieldSetElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{
    conflict: boolean;
    message: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const reasonRequired = decision !== null && decision !== "verify";

  function validate() {
    const next: Record<string, string> = {};
    if (!decision) next.decision = "Pilih salah satu keputusan.";
    if (reasonRequired || reason.trim()) {
      const invalid = reasonError(reason);
      if (invalid) next.reason = invalid;
    }
    if (decision === "duplicate" && !target)
      next.duplicateOfReportId = "Pilih laporan rujukan.";
    return next;
  }

  function focusFirst(next: Record<string, string>) {
    if (next.decision)
      decisionRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    else if (next.duplicateOfReportId)
      document.getElementById("duplicateOfReportId")?.focus();
    else if (next.reason) reasonRef.current?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length || !decision) {
      focusFirst(next);
      return;
    }
    setPending(true);
    const result = await postReportAction(
      `/api/v1/reports/${reportId}/review`,
      {
        decision,
        expectedVersion,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(decision === "duplicate" ? { duplicateOfReportId: target } : {}),
      },
    );
    setPending(false);
    if (result.kind === "ok") {
      router.replace(`/pengelola/verifikasi/${reportId}?keputusan=tersimpan`);
      router.refresh();
      return;
    }
    if (result.kind === "invalid" && Object.keys(result.fieldErrors).length) {
      setErrors(result.fieldErrors);
      focusFirst(result.fieldErrors);
      return;
    }
    setFailure({
      conflict: result.kind === "conflict",
      message: result.message,
    });
  }

  const describedBy = (id: string, help?: boolean) =>
    [help ? `${id}-help` : null, errors[id] ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const errorText = (id: string) =>
    errors[id] ? (
      <p
        id={`${id}-error`}
        className="text-sm font-medium text-[var(--danger)]"
      >
        {errors[id]}
      </p>
    ) : null;

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="review-title"
      className="grid gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 [&>*]:min-w-0"
    >
      <h2 id="review-title" className="text-lg font-bold">
        Keputusan pemeriksaan
      </h2>
      <fieldset
        ref={decisionRef}
        aria-describedby={describedBy("decision")}
        className="grid gap-3"
      >
        <legend className="mb-3 font-semibold">
          Pilih keputusan <span aria-hidden="true">*</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {decisions.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer gap-3 rounded-[var(--radius-control)] border border-[var(--border)] p-4 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-subtle)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--primary)]"
            >
              <input
                type="radio"
                name="decision"
                value={option.value}
                checked={decision === option.value}
                onChange={() => {
                  setDecision(option.value);
                  setErrors({});
                }}
                className="mt-1 size-4 accent-[var(--primary)]"
              />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-sm text-[var(--muted-foreground)]">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errorText("decision")}
      </fieldset>

      {decision === "duplicate" ? (
        <div className="grid gap-2">
          <label htmlFor="duplicateOfReportId" className="font-semibold">
            Laporan rujukan <span aria-hidden="true">*</span>
          </label>
          {candidates.length ? (
            <CustomSelect
              id="duplicateOfReportId"
              value={target}
              placeholder="Pilih laporan yang lebih awal"
              ariaLabel="Laporan rujukan duplikat"
              aria-invalid={Boolean(errors.duplicateOfReportId)}
              aria-describedby={describedBy("duplicateOfReportId", true)}
              onChange={(val) => setTarget(val)}
              size="md"
              options={[
                { value: "", label: "Pilih laporan yang lebih awal" },
                ...candidates.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.label,
                })),
              ]}
            />
          ) : null}
          <p
            id="duplicateOfReportId-help"
            className="text-sm text-[var(--muted-foreground)]"
          >
            {candidates.length
              ? "Hanya laporan lebih awal di wilayah yang sama yang dapat dirujuk."
              : "Belum ada laporan lebih awal di wilayah ini yang dapat dirujuk."}
          </p>
          {errorText("duplicateOfReportId")}
        </div>
      ) : null}

      <div className="grid gap-2">
        <label htmlFor="reason" className="font-semibold">
          {reasonRequired ? "Alasan" : "Catatan (opsional)"}
          {reasonRequired ? <span aria-hidden="true"> *</span> : null}
        </label>
        <textarea
          ref={reasonRef}
          id="reason"
          value={reason}
          rows={4}
          maxLength={500}
          aria-required={reasonRequired}
          aria-invalid={Boolean(errors.reason)}
          aria-describedby={describedBy("reason", true)}
          onChange={(event) => setReason(event.target.value)}
          className={controlClass}
        />
        <p id="reason-help" className="text-sm text-[var(--muted-foreground)]">
          10–500 karakter. Wajib untuk keputusan selain verifikasi; alasan
          terlihat oleh pelapor.{" "}
          <span aria-live="polite">{reason.trim().length}/500</span>
        </p>
        {errorText("reason")}
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
      <div className="flex sm:justify-end">
        <Button
          type="submit"
          isLoading={pending}
          disabled={decision === "duplicate" && !candidates.length}
        >
          Simpan keputusan
        </Button>
      </div>
    </form>
  );
}
