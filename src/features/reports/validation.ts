import { z } from "zod";

export const reportCategorySchema = z.enum([
  "water_container",
  "discarded_tire",
  "clogged_drain",
  "discarded_item",
  "other",
]);

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
      message: "Teks mengandung karakter yang tidak didukung.",
    });

export const reportLocationSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90).nullable(),
    longitude: z.number().finite().min(-180).max(180).nullable(),
    note: safeText(250).optional(),
  })
  .strict()
  .refine(
    (location) =>
      (location.latitude === null) === (location.longitude === null),
    {
      message: "Titik lokasi harus memiliki lintang dan bujur.",
    },
  );

export const createReportSchema = z
  .object({
    areaId: z.uuid(),
    category: reportCategorySchema,
    description: safeText(1000).pipe(z.string().min(10)),
    imageUploadIds: z
      .array(z.uuid())
      .min(1)
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length),
    location: reportLocationSchema.nullable(),
  })
  .strict();

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);

export const reportStatusSchema = z.enum([
  "pending_verification",
  "verified",
  "needs_information",
  "rejected",
  "duplicate",
  "in_action",
  "resolved",
]);

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
      );
    },
    { message: "Tanggal tidak valid." },
  );

export const reportListQuerySchema = z
  .object({
    page: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(10000))
      .default(1),
    limit: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(50))
      .default(10),
    category: reportCategorySchema.optional(),
    status: z
      .string()
      .max(200)
      .transform((value) => value.split(","))
      .pipe(
        z
          .array(reportStatusSchema)
          .min(1)
          .max(7)
          .refine((statuses) => new Set(statuses).size === statuses.length),
      )
      .optional(),
    areaId: z.uuid().optional(),
    submittedFrom: dateOnly.optional(),
    submittedTo: dateOnly.optional(),
  })
  .strict()
  .refine(
    (query) =>
      !query.submittedFrom ||
      !query.submittedTo ||
      query.submittedFrom <= query.submittedTo,
    { message: "Rentang tanggal tidak valid.", path: ["submittedTo"] },
  );

export type ReportCategory = z.infer<typeof reportCategorySchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export type ReportListFilters = Omit<
  z.infer<typeof reportListQuerySchema>,
  "page" | "limit"
>;

// Date filters are calendar days in WIB, the demo areas' local time.
export function jakartaDayStart(date: string, addDays = 0) {
  const start = new Date(`${date}T00:00:00+07:00`);
  return new Date(start.getTime() + addDays * 86_400_000).toISOString();
}

const expectedVersionSchema = z.number().int().min(1).max(2_147_483_647);
const reviewReasonSchema = safeText(500).pipe(
  z.string().min(10, "Alasan minimal 10 karakter."),
);

export const reviewReportSchema = z.discriminatedUnion("decision", [
  z
    .object({
      decision: z.literal("verify"),
      reason: reviewReasonSchema.nullable().optional(),
      expectedVersion: expectedVersionSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal("request_information"),
      reason: reviewReasonSchema,
      expectedVersion: expectedVersionSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal("reject"),
      reason: reviewReasonSchema,
      expectedVersion: expectedVersionSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal("duplicate"),
      reason: reviewReasonSchema,
      expectedVersion: expectedVersionSchema,
      duplicateOfReportId: z.uuid(),
    })
    .strict(),
]);

// API decision names map onto the review_report RPC contract.
export const reviewDecisionRpc = {
  verify: "verify",
  request_information: "request_information",
  reject: "reject",
  duplicate: "mark_duplicate",
} as const;

export const addReportInformationSchema = z
  .object({
    note: safeText(500).pipe(
      z.string().min(10, "Informasi minimal 10 karakter."),
    ),
    expectedVersion: expectedVersionSchema,
  })
  .strict();

export const reportCategoryLabels: Record<
  z.infer<typeof reportCategorySchema>,
  string
> = {
  water_container: "Wadah air terbuka",
  discarded_tire: "Ban bekas",
  clogged_drain: "Saluran tersumbat",
  discarded_item: "Barang bekas",
  other: "Temuan lain",
};

export const reportStatusLabels = {
  pending_verification: "Menunggu Pemeriksaan",
  verified: "Terverifikasi",
  needs_information: "Perlu Informasi Tambahan",
  rejected: "Tidak Disetujui",
  duplicate: "Laporan Duplikat",
  in_action: "Dalam Penanganan",
  resolved: "Selesai",
} as const;

export const reportEventLabels: Record<string, string> = {
  report_created: "Laporan dikirim",
  report_verified: "Diverifikasi kader",
  report_information_requested: "Kader meminta informasi tambahan",
  report_information_added: "Informasi tambahan dikirim",
  report_rejected: "Tidak disetujui kader",
  report_marked_duplicate: "Ditandai sebagai duplikat",
};
