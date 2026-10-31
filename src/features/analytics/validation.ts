import { z } from "zod";

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

export function jakartaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    now,
  );
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Default cohort: the last 30 WIB calendar days including today; at most 366 days.
export function summaryQuerySchema(now = new Date()) {
  const today = jakartaToday(now);
  return z
    .object({
      areaId: z.uuid().optional(),
      from: dateOnly.optional(),
      to: dateOnly.optional(),
    })
    .strict()
    .transform((query) => {
      const to = query.to ?? today;
      return {
        areaId: query.areaId ?? null,
        from: query.from ?? shiftDate(to, -29),
        to,
      };
    })
    .refine((query) => query.from <= query.to, {
      message: "Tanggal awal harus sebelum tanggal akhir.",
      path: ["from"],
    })
    .refine((query) => shiftDate(query.from, 365) >= query.to, {
      message: "Rentang maksimal 366 hari.",
      path: ["to"],
    });
}

export type SummaryQuery = z.infer<ReturnType<typeof summaryQuerySchema>>;
