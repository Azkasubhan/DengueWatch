import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  ImageValidationError,
  maxImageBytes,
  normalizeReportImage,
} from "@/features/reports/image";

async function fixture(format: "jpeg" | "png" | "webp") {
  const bytes = await sharp({
    create: { width: 32, height: 24, channels: 3, background: "#abc7bd" },
  })
    [format]()
    .toBuffer();
  const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`;
  return new File([bytes], `fixture.${format}`, { type: mime });
}

describe("report image processing", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes %s and stores normalized WebP",
    async (format) => {
      const result = await normalizeReportImage(await fixture(format));
      expect(result.mimeType).toBe("image/webp");
      expect(result.byteSize).toBeGreaterThan(0);
      expect(result.width).toBe(32);
      expect(result.height).toBe(24);
      const metadata = await sharp(result.bytes).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
    },
  );

  it("strips embedded EXIF from a valid JPEG", async () => {
    const bytes = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#abc7bd" },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: "private metadata marker" } })
      .toBuffer();
    expect((await sharp(bytes).metadata()).exif).toBeDefined();
    const result = await normalizeReportImage(
      new File([bytes], "photo.jpg", { type: "image/jpeg" }),
    );
    expect((await sharp(result.bytes).metadata()).exif).toBeUndefined();
    expect(result.bytes.includes(Buffer.from("private metadata marker"))).toBe(
      false,
    );
  });

  it.each([
    [
      "svg",
      "image/svg+xml",
      Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    ],
    ["pdf", "application/pdf", Buffer.from("%PDF-1.7")],
    ["exe", "application/octet-stream", Buffer.from("MZ")],
    ["fake png", "image/png", Buffer.from("not a real PNG")],
  ])("rejects %s masquerading as a photo", async (_name, mime, bytes) => {
    await expect(
      normalizeReportImage(
        new File([bytes], "photo.png", { type: mime as string }),
      ),
    ).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects MIME mismatch, corruption and oversized input", async () => {
    const jpeg = await fixture("jpeg");
    await expect(
      normalizeReportImage(
        new File([await jpeg.arrayBuffer()], "fake.png", { type: "image/png" }),
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      normalizeReportImage(
        new File([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], "bad.jpg", {
          type: "image/jpeg",
        }),
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      normalizeReportImage(
        new File([new Uint8Array(maxImageBytes + 1)], "huge.jpg", {
          type: "image/jpeg",
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
});
