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
