import { describe, expect, it } from "vitest";
import {
  createReportSchema,
  jakartaDayStart,
  reportCategoryLabels,
  reportListQuerySchema,
  reportStatusLabels,
  reviewReportSchema,
} from "@/features/reports/validation";

const valid = {
  areaId: "20000000-0000-4000-8000-000000000001",
  category: "water_container",
  description: "Ada wadah terbuka berisi air di area umum.",
  visibleObjects: "Wadah terbuka, air tergenang",
  preventionAdvice: "Tutup wadah dan kuras seminggu sekali.",
  imageUploadIds: ["30000000-0000-4000-8000-000000000001"],
  location: null,
};

describe("report validation", () => {
  it("accepts the five official categories and maps their safe labels", () => {
    expect(Object.keys(reportCategoryLabels)).toHaveLength(5);
    expect(Object.keys(reportStatusLabels)).toContain("pending_verification");
    for (const category of Object.keys(reportCategoryLabels)) {
      expect(createReportSchema.safeParse({ ...valid, category }).success).toBe(
        true,
      );
    }
    expect(
      createReportSchema.safeParse({ ...valid, category: "medical_risk" })
        .success,
    ).toBe(false);
  });

  it("requires visible objects and prevention advice (T29)", () => {
    for (const patch of [
      { visibleObjects: undefined },
      { visibleObjects: "air" },
      { visibleObjects: "x".repeat(501) },
      { preventionAdvice: undefined },
      { preventionAdvice: "Tutup." },
      { preventionAdvice: "Tutup wadah\nsegera hari ini." },
    ])
      expect(createReportSchema.safeParse({ ...valid, ...patch }).success).toBe(
        false,
      );
  });

  it("trims description, bounds length, and rejects control characters", () => {
    expect(
      createReportSchema.parse({
        ...valid,
        description: `  ${valid.description}  `,
      }).description,
    ).toBe(valid.description);
    for (const description of [
      "singkat",
      "x".repeat(1001),
      "Kalimat dengan\nbaris baru",
      "\u0000".repeat(11),
    ]) {
      expect(
        createReportSchema.safeParse({ ...valid, description }).success,
      ).toBe(false);
    }
    expect(
      createReportSchema.safeParse({
        ...valid,
        description: "<script>alert(1)</script> di area",
      }).success,
    ).toBe(true);
  });

  it("rejects forged fields and invalid or duplicate photo references", () => {
    expect(
      createReportSchema.safeParse({ ...valid, reporterId: valid.areaId })
        .success,
    ).toBe(false);
    expect(
      createReportSchema.safeParse({ ...valid, status: "verified" }).success,
    ).toBe(false);
    for (const ids of [
      [],
      Array(4).fill(valid.imageUploadIds[0]),
      [valid.imageUploadIds[0], valid.imageUploadIds[0]],
      ["not-a-uuid"],
    ]) {
      expect(
        createReportSchema.safeParse({ ...valid, imageUploadIds: ids }).success,
      ).toBe(false);
    }
  });

  it("requires finite coordinate pairs within geographical ranges", () => {
    const location = {
      latitude: -6.2,
      longitude: 106.8,
      note: "Dekat saluran umum",
    };
    expect(createReportSchema.safeParse({ ...valid, location }).success).toBe(
      true,
    );
    expect(
      createReportSchema.safeParse({
        ...valid,
        location: {
          latitude: null,
          longitude: null,
          note: "Dekat saluran umum",
        },
      }).success,
    ).toBe(true);
    for (const bad of [
      { ...location, latitude: 91 },
      { ...location, longitude: -181 },
      { ...location, latitude: Infinity },
      { latitude: -6.2 },
      { latitude: -6.2, longitude: null },
      { latitude: "-6.2", longitude: 106.8 },
    ]) {
      expect(
        createReportSchema.safeParse({ ...valid, location: bad }).success,
      ).toBe(false);
    }
  });

  it("strictly caps pagination and rejects unknown filters", () => {
    expect(reportListQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
    for (const query of [
      { page: "1e3" },
      { page: "0" },
      { limit: "51" },
      { order: "reporter_id" },
    ]) {
      expect(reportListQuerySchema.safeParse(query).success).toBe(false);
    }
  });

  it("bounds queue date filters to WIB calendar days", () => {
    expect(jakartaDayStart("2026-10-31")).toBe("2026-10-30T17:00:00.000Z");
    expect(jakartaDayStart("2026-10-31", 1)).toBe("2026-10-31T17:00:00.000Z");
  });

  it("keeps the verify reason optional and trims review reasons", () => {
    expect(
      reviewReportSchema.safeParse({ decision: "verify", expectedVersion: 1 })
        .success,
    ).toBe(true);
    expect(
      reviewReportSchema.parse({
        decision: "reject",
        reason: "  Lokasi berada di luar fasilitas umum.  ",
        expectedVersion: 2,
      }),
    ).toMatchObject({ reason: "Lokasi berada di luar fasilitas umum." });
    expect(
      reviewReportSchema.safeParse({
        decision: "reject",
        reason: "Alasan\u0007tersembunyi panjang",
        expectedVersion: 2,
      }).success,
    ).toBe(false);
  });
});
