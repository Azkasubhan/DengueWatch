// Browser-side photo preparation before upload. Vercel Functions reject request bodies
// above 4.5 MB, so large camera photos are downscaled and re-encoded as JPEG until the file
// fits uploadTargetBytes (leaving room for multipart overhead). The server still validates,
// strips metadata, and re-encodes every photo to WebP.

export const acceptedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
export const maxOriginalPhotoBytes = 25 * 1024 * 1024;
export const uploadTargetBytes = Math.floor(3.5 * 1024 * 1024);
const maxEdge = 3000;
const qualities = [0.85, 0.75, 0.65];

export class PhotoPreparationError extends Error {}

function encode(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}

export async function prepareUploadPhoto(file: File): Promise<File> {
  if (!acceptedPhotoTypes.includes(file.type))
    throw new PhotoPreparationError("Gunakan foto JPG, PNG, atau WebP.");
  if (file.size < 16)
    throw new PhotoPreparationError("Foto kosong atau rusak.");
  if (file.size > maxOriginalPhotoBytes)
    throw new PhotoPreparationError("Ukuran setiap foto maksimal 25 MiB.");
  if (file.size <= uploadTargetBytes) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoPreparationError(
      "Foto tidak dapat dibaca di perangkat ini. Coba foto lain.",
    );
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    let edge = Math.min(maxEdge, longest);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const scale = edge / longest;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw new PhotoPreparationError(
          "Foto tidak dapat diproses di perangkat ini.",
        );
      // JPEG has no alpha channel; flatten transparent PNG areas onto white.
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of qualities) {
        const blob = await encode(canvas, quality);
        if (blob && blob.size <= uploadTargetBytes)
          return new File(
            [blob],
            `${file.name.replace(/\.[^.]*$/, "") || "foto"}.jpg`,
            { type: "image/jpeg", lastModified: file.lastModified },
          );
      }
      edge = Math.round(edge * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new PhotoPreparationError(
    "Foto terlalu besar. Gunakan foto dengan resolusi lebih kecil.",
  );
}
