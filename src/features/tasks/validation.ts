import { z } from "zod";

export const taskStatusSchema = z.enum([
  "assigned",
  "in_progress",
  "awaiting_review",
  "completed",
  "reopened",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

const safeText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .min(min, message)
    .max(max)
    .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
      message: "Teks mengandung karakter yang tidak didukung.",
    });

const expectedVersion = z.number().int().min(1).max(2_147_483_647);
const actionReason = safeText(10, 500, "Alasan minimal 10 karakter.");

export const createTaskSchema = z
  .object({
    title: safeText(5, 140, "Judul minimal 5 karakter."),
    description: safeText(10, 1000, "Deskripsi minimal 10 karakter."),
    // T27/T28: one task may go to any number of distinct cadres of the area.
    assignees: z
      .array(z.uuid())
      .min(1, "Pilih minimal satu kader.")
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Kader tidak boleh dipilih dua kali.",
      ),
    // T28: a calendar date; the RPC stores the end of that day in WIB.
    dueDate: z.iso.date("Pilih tanggal tenggat."),
  })
  .strict();

export const expectedVersionSchema = z.object({ expectedVersion }).strict();

export const submitEvidenceSchema = z
  .object({
    uploadId: z.uuid(),
    description: safeText(10, 500, "Catatan bukti minimal 10 karakter."),
    expectedVersion,
  })
  .strict();

// T33: managers review one cadre's evidence at a time.
export const reviewEvidenceSchema = z.discriminatedUnion("decision", [
  z
    .object({
      evidenceId: z.uuid(),
      decision: z.literal("approve"),
      reason: actionReason.nullable().optional(),
      expectedVersion,
    })
    .strict(),
  z
    .object({
      evidenceId: z.uuid(),
      decision: z.literal("request_revision"),
      reason: actionReason,
      expectedVersion,
    })
    .strict(),
]);

export const taskReasonSchema = z
  .object({ reason: actionReason, expectedVersion })
  .strict();

const positiveInt = (max: number, fallback: number) =>
  z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .default(fallback);

export const taskListQuerySchema = z
  .object({
    page: positiveInt(10000, 1),
    limit: positiveInt(50, 20),
    status: z
      .string()
      .max(200)
      .transform((value) => value.split(","))
      .pipe(
        z
          .array(taskStatusSchema)
          .min(1)
          .max(6)
          .refine((statuses) => new Set(statuses).size === statuses.length),
      )
      .optional(),
    reportId: z.uuid().optional(),
    areaId: z.uuid().optional(),
    assignee: z.literal("me").optional(),
    due: z.enum(["all", "overdue", "due_soon"]).optional(),
    needsReview: z.enum(["1", "true"]).optional(),
    q: safeText(1, 60, "Pencarian tidak valid.").optional(),
    sort: z.enum(["newest", "due_asc"]).optional(),
  })
  .strict();

export type TaskListFilters = Omit<
  z.infer<typeof taskListQuerySchema>,
  "page" | "limit"
>;

export const taskStatusLabels: Record<TaskStatus, string> = {
  assigned: "Ditugaskan",
  in_progress: "Sedang Dikerjakan",
  awaiting_review: "Menunggu Pemeriksaan Bukti",
  completed: "Selesai",
  reopened: "Dibuka Kembali",
  cancelled: "Dibatalkan",
};

export const taskEventLabels: Record<string, string> = {
  task_created: "Tugas dibuat dan ditugaskan",
  task_started: "Tugas mulai dikerjakan",
  task_evidence_submitted: "Bukti dikirim",
  task_evidence_approved: "Bukti kader disetujui",
  task_revision_requested: "Bukti perlu diperbaiki",
  task_cancelled: "Tugas dibatalkan",
  task_reopened: "Tugas dibuka kembali",
};
