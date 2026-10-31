"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  controlClass,
  postReportAction,
} from "@/features/reports/components/reportAction";

type Fields = {
  title: string;
  description: string;
  dueAt: string;
  isMandatory: boolean;
};

const empty: Fields = {
  title: "",
  description: "",
  dueAt: "",
  isMandatory: true,
};

function validate(fields: Fields) {
  const next: Record<string, string> = {};
  const title = fields.title.trim().length;
  const description = fields.description.trim().length;
  if (title < 5 || title > 140) next.title = "Judul 5–140 karakter.";
  if (description < 10 || description > 1000)
    next.description = "Deskripsi 10–1000 karakter.";
  if (fields.dueAt && new Date(`${fields.dueAt}:00+07:00`) <= new Date())
    next.dueAt = "Tenggat harus di masa depan.";
  return next;
}

// MVP assigns the task to the signed-in cadre; the RPC re-checks area membership.
export function CreateTaskForm({
  assigneeId,
  reportId,
}: {
  assigneeId: string;
  reportId: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(empty);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    // A changed payload is a new request; an unchanged retry reuses the key.
    setRequestKey(crypto.randomUUID());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setNotice(null);
    const next = validate(fields);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`task-${first}`)?.focus();
      return;
    }
    setPending(true);
    const result = await postReportAction(
      `/api/v1/reports/${reportId}/tasks`,
      {
        title: fields.title.trim(),
        description: fields.description.trim(),
        assignedTo: assigneeId,
        dueAt: fields.dueAt ? `${fields.dueAt}:00+07:00` : null,
        isMandatory: fields.isMandatory,
      },
      { "Idempotency-Key": requestKey },
    );
    setPending(false);
    if (result.kind === "ok") {
      setFields(empty);
      setRequestKey(crypto.randomUUID());
      setNotice("Tugas dibuat dan ditugaskan kepada Anda.");
      router.refresh();
      return;
    }
    if (result.kind === "invalid" && Object.keys(result.fieldErrors).length) {
      setErrors(result.fieldErrors);
      return;
    }
    setFailure(result.message);
  }

  const help = (id: string, text: string) => (
    <>
      <p
        id={`task-${id}-help`}
        className="text-sm text-[var(--muted-foreground)]"
      >
        {text}
      </p>
      {errors[id] ? (
        <p
          id={`task-${id}-error`}
          className="text-sm font-medium text-[var(--danger)]"
        >
          {errors[id]}
        </p>
      ) : null}
    </>
  );
  const describedBy = (id: string) =>
    `task-${id}-help${errors[id] ? ` task-${id}-error` : ""}`;

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="create-task-title"
      className="mt-5 grid gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
    >
      <h3 id="create-task-title" className="text-xl font-bold">
        Buat tugas tindak lanjut
      </h3>
      <div className="grid gap-2">
        <label htmlFor="task-title" className="font-semibold">
          Judul tugas <span aria-hidden="true">*</span>
        </label>
        <input
          id="task-title"
          value={fields.title}
          maxLength={140}
          aria-required="true"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describedBy("title")}
          onChange={(event) => update("title", event.target.value)}
          className={controlClass}
        />
        {help("title", "5–140 karakter, misalnya “Kuras wadah di balai”.")}
      </div>
      <div className="grid gap-2">
        <label htmlFor="task-description" className="font-semibold">
          Deskripsi tindakan <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="task-description"
          rows={3}
          maxLength={1000}
          value={fields.description}
          aria-required="true"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy("description")}
          onChange={(event) => update("description", event.target.value)}
          className={controlClass}
        />
        {help("description", "10–1000 karakter.")}
      </div>
      <div className="grid gap-2">
        <label htmlFor="task-dueAt" className="font-semibold">
          Tenggat (opsional)
        </label>
        <input
          id="task-dueAt"
          type="datetime-local"
          value={fields.dueAt}
          aria-invalid={Boolean(errors.dueAt)}
          aria-describedby={describedBy("dueAt")}
          onChange={(event) => update("dueAt", event.target.value)}
          className={controlClass}
        />
        {help("dueAt", "Waktu dalam WIB.")}
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={fields.isMandatory}
          onChange={(event) => update("isMandatory", event.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        <span>Wajib selesai sebelum laporan dinyatakan tuntas</span>
      </label>
      <p className="text-sm text-[var(--muted-foreground)]">
        Tugas ditugaskan kepada Anda. Bukti harus diperiksa kader lain.
      </p>
      <div aria-live="polite">
        {notice ? (
          <p className="rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4 font-semibold">
            {notice}
          </p>
        ) : null}
      </div>
      {failure ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 font-semibold text-[var(--danger)]"
        >
          {failure}
        </p>
      ) : null}
      <div>
        <Button type="submit" isLoading={pending}>
          Buat tugas
        </Button>
      </div>
    </form>
  );
}
