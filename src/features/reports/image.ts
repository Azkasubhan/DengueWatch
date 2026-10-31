import sharp from "sharp";

export const maxImageBytes = 5 * 1024 * 1024;
export const maxImagePixels = 24_000_000;

export class ImageValidationError extends Error {
  constructor(
    public readonly status: 413 | 415 | 422,
    message: string,
  ) {
    super(message);
  }
}

export function sniffImageType(bytes: Uint8Array) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes).toString("ascii", 0, 4) === "RIFF" &&
    Buffer.from(bytes).toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

export async function normalizeReportImage(file: File) {
  if (file.size === 0)
    throw new ImageValidationError(422, "Foto kosong atau rusak.");
  if (file.size > maxImageBytes)
    throw new ImageValidationError(413, "Foto maksimal 5 MiB.");
  const input = Buffer.from(await file.arrayBuffer());
  const detected = sniffImageType(input);
  if (
    !detected ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  ) {
    throw new ImageValidationError(415, "Gunakan foto JPG, PNG, atau WebP.");
  }
  if (file.type !== detected)
    throw new ImageValidationError(
      415,
      "Tipe foto tidak sesuai dengan isinya.",
    );
  try {
    const decoder = sharp(input, {
      failOn: "error",
      limitInputPixels: maxImagePixels,
      animated: false,
    });
    const meta = await decoder.metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width > 6000 ||
      meta.height > 6000 ||
      meta.width * meta.height > maxImagePixels ||
      (meta.pages ?? 1) > 1
    ) {
      throw new ImageValidationError(422, "Dimensi foto tidak didukung.");
    }
    const output = await decoder
      .rotate()
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    if (output.length > maxImageBytes)
      throw new ImageValidationError(
        413,
        "Foto hasil pemrosesan melebihi 5 MiB.",
      );
    const normalized = await sharp(output, {
      limitInputPixels: maxImagePixels,
    }).metadata();
    if (
      normalized.format !== "webp" ||
      !normalized.width ||
      !normalized.height ||
      normalized.exif ||
      normalized.xmp ||
      normalized.icc
    ) {
      throw new ImageValidationError(
        422,
        "Foto tidak dapat diproses dengan aman.",
      );
    }
    return {
      bytes: output,
      byteSize: output.length,
      width: normalized.width,
      height: normalized.height,
      mimeType: "image/webp" as const,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError(422, "Foto kosong atau rusak.");
  }
}
