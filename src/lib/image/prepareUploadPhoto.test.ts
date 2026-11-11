import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PhotoPreparationError,
  prepareUploadPhoto,
  uploadTargetBytes,
} from "@/lib/image/prepareUploadPhoto";

const MiB = 1024 * 1024;

function photo(size: number, type = "image/jpeg", name = "kamera.jpeg") {
  return new File([new Uint8Array(size)], name, { type });
}

// Encoded size grows with pixel count and quality, roughly like a real JPEG encoder.
let bytesPerPixel = 1;
const drawn: Array<{ width: number; height: number }> = [];
const close = vi.fn();

beforeEach(() => {
  bytesPerPixel = 1;
  drawn.length = 0;
  close.mockClear();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 4000, height: 3000, close })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn(() =>
          drawn.push({ width: this.width, height: this.height }),
        ),
      } as unknown as CanvasRenderingContext2D;
    } as unknown as HTMLCanvasElement["getContext"],
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    _type?: string,
    quality = 1,
  ) {
    const size = Math.round(this.width * this.height * bytesPerPixel * quality);
    callback(new Blob([new Uint8Array(size)], { type: "image/jpeg" }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("prepareUploadPhoto", () => {
  it("returns small photos unchanged without decoding them", async () => {
    const file = photo(2 * MiB);
    await expect(prepareUploadPhoto(file)).resolves.toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("downscales large photos to JPEG under the upload target", async () => {
    const result = await prepareUploadPhoto(photo(9 * MiB));
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("kamera.jpg");
    expect(result.size).toBeLessThanOrEqual(uploadTargetBytes);
    // Longest edge capped at 3000 px with the aspect ratio kept.
    expect(drawn[0]).toEqual({ width: 3000, height: 2250 });
    expect(close).toHaveBeenCalledOnce();
  });

  it("shrinks further when quality steps alone are not enough", async () => {
    bytesPerPixel = 1.2;
    const result = await prepareUploadPhoto(
      photo(12 * MiB, "image/png", "a.png"),
    );
    expect(result.size).toBeLessThanOrEqual(uploadTargetBytes);
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.at(-1)!.width).toBeLessThan(3000);
  });

  it("fails with a clear message when the photo cannot get small enough", async () => {
    bytesPerPixel = 50;
    await expect(prepareUploadPhoto(photo(12 * MiB))).rejects.toThrow(
      "Foto terlalu besar",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([
    [
      photo(1 * MiB, "image/heic", "a.heic"),
      "Gunakan foto JPG, PNG, atau WebP.",
    ],
    [photo(8), "Foto kosong atau rusak."],
    [photo(26 * MiB), "Ukuran setiap foto maksimal 25 MiB."],
  ])("rejects unsupported input %#", async (file, message) => {
    await expect(prepareUploadPhoto(file)).rejects.toThrow(message);
  });

  it("reports photos the browser cannot decode", async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("decode"));
    await expect(prepareUploadPhoto(photo(9 * MiB))).rejects.toBeInstanceOf(
      PhotoPreparationError,
    );
  });
});
