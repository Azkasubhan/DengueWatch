import { z } from "zod";
import { reportCategorySchema } from "@/features/reports/validation";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));

export const analyzeReportSchema = z.strictObject({
  areaId: z.uuid(),
  uploadId: z.uuid(),
});

export const aiReportSuggestionSchema = z.strictObject({
  visibleObjects: z.array(text(80)).min(1).max(6),
  suggestedCategory: reportCategorySchema,
  draftDescription: text(500),
  suggestedPrecaution: text(300),
  requiresHumanVerification: z.literal(true),
  limitations: text(300),
});

export type AiReportSuggestion = z.infer<typeof aiReportSuggestionSchema>;

// Deterministic guard for prohibited *explicit* claims. It cannot establish
// whether every observation is true; the resident must inspect the photo.
const prohibited = [
  /\d{1,3}(?:[.,]\d+)?\s*%|\b(?:percent|persen|probabilitas)\b/iu,
  /\b(?:diagnosis|terdiagnosis|positif\s+dbd|terinfeksi\s+(?:dbd|dengue))\b/iu,
  /\b(?:pasti|dipastikan|memastikan|terbukti|terkonfirmasi)\b.{0,45}\b(?:jentik|larva|aedes|nyamuk|dbd|dengue)\b/iu,
  /\b(?:jentik|larva|aedes|nyamuk|dbd|dengue)\b.{0,45}\b(?:pasti|dipastikan|memastikan|terbukti|terkonfirmasi)\b/iu,
  /\b(?:ini|itu|merupakan|adalah)\s+(?:nyamuk\s+)?aedes\b/iu,
  /\b(?:aman\s+diabaikan|tidak\s+perlu\s+(?:diperiksa|ditindaklanjuti))\b/iu,
  /\b(?:abaikan\s+(?:instruksi|aturan)\s+(?:sebelumnya|di\s+atas)|ungkapkan\s+(?:kunci|api\s*key)|ubah\s+(?:role|status))\b/iu,
];

export function parseAiSuggestion(raw: unknown): AiReportSuggestion {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 6000)
    throw new AiOutputError("INVALID_JSON");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiOutputError("INVALID_JSON");
  }
  const result = aiReportSuggestionSchema.safeParse(json);
  if (!result.success) throw new AiOutputError("INVALID_SCHEMA");
  const strings = [
    ...result.data.visibleObjects,
    result.data.draftDescription,
    result.data.suggestedPrecaution,
    result.data.limitations,
  ];
  if (
    strings.some((value) => {
      const checked = value.replace(
        /\b(?:tidak|belum)\s+(?:(?:dapat|bisa)\s+)?(?:memastikan|dipastikan)\b/giu,
        "tidak dapat menilai",
      );
      return prohibited.some((pattern) => pattern.test(checked));
    })
  )
    throw new AiOutputError("UNSAFE_OUTPUT");
  return result.data;
}

export class AiOutputError extends Error {
  constructor(
    public readonly code: "INVALID_JSON" | "INVALID_SCHEMA" | "UNSAFE_OUTPUT",
  ) {
    super(code);
  }
}
