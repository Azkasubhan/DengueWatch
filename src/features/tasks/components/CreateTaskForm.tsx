"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { toast } from "@/components/ui/Toast";
import {
  controlClass,
  postReportAction,
} from "@/features/reports/components/reportAction";

type Fields = {
  title: string;
  description: string;
  // One picker row per entry; "" is a row without a chosen cadre yet.
  assignees: string[];
  dueDate: string;
};

const empty: Fields = {
  title: "",
  description: "",
  assignees: [""],
  dueDate: "",
};

// Dates are YYYY-MM-DD calendar days in WIB; arithmetic runs in UTC to avoid DST shifts.
const jakartaToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
const longDate = (day: string) =>
  new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));

const quickDates = [
  { label: "Hari ini", days: 0 },
  { label: "Besok", days: 1 },
  { label: "3 hari", days: 3 },
  { label: "1 minggu", days: 7 },
];

function relativeDay(days: number) {
  if (days === 0) return "hari ini";
  if (days === 1) return "besok";
  return `${days} hari lagi`;
}

function validate(fields: Fields, today: string) {
  const next: Record<string, string> = {};
  const title = fields.title.trim().length;
  const description = fields.description.trim().length;
  if (title < 5 || title > 140) next.title = "Judul 5–140 karakter.";
  if (description < 10 || description > 1000)
    next.description = "Deskripsi 10–1000 karakter.";
  if (!fields.assignees.some(Boolean))
    next.assignees = "Pilih minimal satu kader.";
  else if (fields.assignees.some((id) => !id))
    next.assignees =
      "Pilih kader pada setiap baris atau hapus baris yang kosong.";
  if (!fields.dueDate) next.dueDate = "Pilih tanggal tenggat.";
  else if (fields.dueDate < today)
    next.dueDate = "Tenggat tidak boleh sebelum hari ini.";
  else if (fields.dueDate > addDays(today, 366))
    next.dueDate = "Tenggat paling lambat satu tahun dari hari ini.";
  return next;
}

// T27/T28: the manager picks cadres one by one from the report area (no fixed
// maximum) and a required due date; the RPC re-checks every assignee and the date.
export function CreateTaskForm({
  cadres,
  reportId,
}: {
  cadres: { id: string; name: string }[];
  reportId: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(empty);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [today] = useState(jakartaToday);
  const pickers = useRef<(HTMLElement | null)[]>([]);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    // A changed payload is a new request; an unchanged retry reuses the key.
    setRequestKey(crypto.randomUUID());
  }

  function setAssignee(index: number, id: string) {
    update(
      "assignees",
      fields.assignees.map((current, i) => (i === index ? id : current)),
    );
  }

  function addAssignee() {
    const index = fields.assignees.length;
    update("assignees", [...fields.assignees, ""]);
    requestAnimationFrame(() => pickers.current[index]?.focus());
  }

  function removeAssignee(index: number) {
    update(
      "assignees",
      fields.assignees.filter((_, i) => i !== index),
    );
    requestAnimationFrame(() =>
      pickers.current[Math.max(0, index - 1)]?.focus(),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setNotice(null);
    const next = validate(fields, today);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      const emptyRow = Math.max(0, fields.assignees.indexOf(""));
      document
        .getElementById(
          first === "assignees" ? `task-assignee-${emptyRow}` : `task-${first}`,
        )
        ?.focus();
      return;
    }
    setPending(true);
    const result = await postReportAction(
      `/api/v1/reports/${reportId}/tasks`,
      {
        title: fields.title.trim(),
        description: fields.description.trim(),
        assignees: fields.assignees,
        dueDate: fields.dueDate,
      },
      { "Idempotency-Key": requestKey },
    );
    setPending(false);
    if (result.kind === "ok") {
      setFields(empty);
      setRequestKey(crypto.randomUUID());
      setNotice("Tugas dibuat dan dikirim ke kader yang dipilih.");
      toast.success("Tugas lapangan berhasil dibuat!");
      router.refresh();
      return;
    }
    if (result.kind === "invalid" && Object.keys(result.fieldErrors).length) {
      // Per-item errors ("assignees.0") belong to the picker as a whole.
      const fieldErrors: Record<string, string> = {};
      for (const [key, message] of Object.entries(result.fieldErrors))
        fieldErrors[key.replace(/\..*$/, "")] ??= message;
      setErrors(fieldErrors);
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
      className="mt-5 grid gap-4 rounded-[var(--radius-control)] bg-[var(--background)] p-3 sm:p-4 [&>*]:min-w-0"
    >
      <h3 id="create-task-title" className="font-semibold">
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
      <fieldset
        className="grid gap-2"
        aria-describedby={describedBy("assignees")}
      >
        <legend className="mb-2 font-semibold">
          Kader pelaksana <span aria-hidden="true">*</span>
        </legend>
        {cadres.length ? (
          <>
            <ul className="grid gap-2">
              {fields.assignees.map((selected, index) => {
                const name = cadres.find(
                  (cadre) => cadre.id === selected,
                )?.name;
                return (
                  <li key={index} className="flex items-center gap-2">
                    <div
                      className="min-w-0 flex-1"
                      ref={(node) => {
                        pickers.current[index] = node;
                      }}
                    >
                      <CustomSelect
                        id={`task-assignee-${index}`}
                        value={selected}
                        placeholder="Pilih kader…"
                        ariaLabel={`Kader pelaksana ${index + 1}`}
                        aria-invalid={Boolean(errors.assignees) && !selected}
                        aria-describedby={describedBy("assignees")}
                        size="md"
                        onChange={(val) => setAssignee(index, val)}
                        options={[
                          { value: "", label: "Pilih kader…" },
                          ...cadres
                            .filter(
                              (cadre) =>
                                cadre.id === selected ||
                                !fields.assignees.includes(cadre.id),
                            )
                            .map((cadre) => ({
                              value: cadre.id,
                              label: cadre.name,
                            })),
                        ]}
                      />
                    </div>
                    {fields.assignees.length > 1 ? (
                      <Button
                        variant="ghost"
                        className="shrink-0 px-3"
                        aria-label={`Hapus ${name ?? `baris kader ${index + 1}`}`}
                        onClick={() => removeAssignee(index)}
                      >
                        <X aria-hidden="true" className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {fields.assignees.length < cadres.length ? (
              <div>
                <Button variant="secondary" onClick={addAssignee}>
                  <Plus aria-hidden="true" className="size-4" />
                  Tambah kader
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm">
            Belum ada kader terverifikasi di wilayah ini.
          </p>
        )}
        {help(
          "assignees",
          "Pilih kader satu per satu. Setiap kader terpilih wajib mengirim bukti sendiri; tugas selesai setelah semua bukti disetujui.",
        )}
      </fieldset>
      <fieldset
        className="grid gap-2"
        aria-describedby={describedBy("dueDate")}
      >
        <legend className="mb-2 font-semibold">
          Tenggat <span aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {quickDates.map((quick) => {
            const day = addDays(today, quick.days);
            return (
              <Button
                key={quick.days}
                variant="secondary"
                aria-pressed={fields.dueDate === day}
                onClick={() => update("dueDate", day)}
                className="aria-pressed:border-[var(--primary)] aria-pressed:bg-[var(--primary-subtle)]"
              >
                {quick.label}
              </Button>
            );
          })}
        </div>
        <label htmlFor="task-dueDate" className="text-sm">
          Atau pilih tanggal
        </label>
        <div className="sm:max-w-xs">
          <CustomDatePicker
            id="task-dueDate"
            value={fields.dueDate}
            min={today}
            max={addDays(today, 366)}
            placeholder="Pilih batas tanggal"
            ariaLabel="Batas tanggal penyelesaian"
            aria-invalid={Boolean(errors.dueDate)}
            aria-describedby={describedBy("dueDate")}
            onChange={(val) => update("dueDate", val)}
            size="md"
          />
        </div>
        <p aria-live="polite" className="min-h-6 font-semibold">
          {fields.dueDate && fields.dueDate >= today
            ? `${longDate(fields.dueDate)} · ${relativeDay(daysBetween(today, fields.dueDate))}`
            : ""}
        </p>
        {help("dueDate", "Batas akhir pukul 23.59 WIB pada tanggal tersebut.")}
      </fieldset>
      <p className="text-sm text-[var(--muted-foreground)]">
        Bukti dari kader akan Anda periksa sebelum tugas dinyatakan selesai.
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
      <div className="flex sm:justify-end">
        {/* No verified cadre in the area means the task cannot be assigned yet. */}
        <Button type="submit" isLoading={pending} disabled={!cadres.length}>
          Buat tugas
        </Button>
      </div>
    </form>
  );
}
