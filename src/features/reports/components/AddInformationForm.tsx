"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  controlClass,
  postReportAction,
  reasonError,
} from "@/features/reports/components/reportAction";

export function AddInformationForm({
  expectedVersion,
  reportId,
}: {
  expectedVersion: number;
  reportId: string;
}) {
  const router = useRouter();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [failure, setFailure] = useState<{
    conflict: boolean;
    message: string;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    const invalid = reasonError(note);
    setNoteError(invalid);
    if (invalid) {
      noteRef.current?.focus();
      return;
    }
    setPending(true);
    const result = await postReportAction(
      `/api/v1/reports/${reportId}/add-information`,
      { note: note.trim(), expectedVersion },
    );
    setPending(false);
    if (result.kind === "ok") {
      router.replace(`/app/laporan/${reportId}?informasi=terkirim`);
      router.refresh();
      return;
    }
    if (result.kind === "invalid" && result.fieldErrors.note) {
      setNoteError(result.fieldErrors.note);
      noteRef.current?.focus();
      return;
    }
    setFailure({
      conflict: result.kind === "conflict",
      message: result.message,
    });
  }

  return (
    <form noValidate onSubmit={submit} className="mt-4 grid gap-3">
      <label htmlFor="information-note" className="font-semibold">
        Informasi tambahan <span aria-hidden="true">*</span>
      </label>
      <textarea
        ref={noteRef}
        id="information-note"
        value={note}
        rows={4}
        maxLength={500}
        aria-required="true"
        aria-invalid={Boolean(noteError)}
        aria-describedby={`information-note-help${noteError ? " information-note-error" : ""}`}
        onChange={(event) => setNote(event.target.value)}
        className={controlClass}
      />
      <p
        id="information-note-help"
        className="text-sm text-[var(--muted-foreground)]"
      >
        10–500 karakter. Jelaskan kondisi terbaru tanpa identitas penghuni.{" "}
        <span aria-live="polite">{note.trim().length}/500</span>
      </p>
      {noteError ? (
        <p
          id="information-note-error"
          className="text-sm font-medium text-[var(--danger)]"
        >
          {noteError}
        </p>
      ) : null}
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
        <Button type="submit" isLoading={pending}>
          Kirim informasi
        </Button>
      </div>
    </form>
  );
}
