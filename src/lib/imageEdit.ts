import type { PixelCrop } from "react-image-crop";

export type Transform = {
  /** Crop rectangle in natural pixels. Null = whole image. */
  crop: PixelCrop | null;
  /** 0, 90, 180, 270 degrees clockwise. */
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
};

/**
 * Render an image element through a crop + rotate/flip pipeline and return
 * the result as a Blob, ready to upload.
 *
 * The image is drawn onto a canvas sized to the crop; rotation swaps width and
 * height for the odd quarter-turns.
 */
export async function renderEdited(
  img: HTMLImageElement,
  t: Transform,
  type = "image/jpeg",
  quality = 0.9
): Promise<Blob> {
  const sx = t.crop ? t.crop.x : 0;
  const sy = t.crop ? t.crop.y : 0;
  const sw = t.crop ? t.crop.width : img.naturalWidth;
  const sh = t.crop ? t.crop.height : img.naturalHeight;

  const rotated = t.rotate === 90 || t.rotate === 270;
  const canvas = document.createElement("canvas");
  canvas.width = rotated ? sh : sw;
  canvas.height = rotated ? sw : sh;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  ctx.save();
  // Move to canvas centre, apply rotation + flips, then draw the crop centred.
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((t.rotate * Math.PI) / 180);
  ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
  ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed."))),
      type,
      quality
    );
  });
}
