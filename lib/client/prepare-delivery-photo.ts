// Runs in the browser. Re-encoding through a canvas normalizes iPhone HEIC to
// JPEG, applies EXIF orientation, shrinks the upload for bad signal, and strips
// EXIF (incl. GPS) so the buyer never receives the driver's location.
const TARGET_MAX_BYTES = 1_500_000;
const ATTEMPTS: Array<{ edge: number; quality: number }> = [
  { edge: 1600, quality: 0.82 },
  { edge: 1600, quality: 0.7 },
  { edge: 1200, quality: 0.7 },
];

function encode(bitmap: ImageBitmap, edge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no_canvas"));
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, width, height }) : reject(new Error("encode_failed"))), "image/jpeg", quality),
  );
}

export async function prepareDeliveryPhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    let out = await encode(bitmap, ATTEMPTS[0].edge, ATTEMPTS[0].quality);
    for (const a of ATTEMPTS.slice(1)) {
      if (out.blob.size <= TARGET_MAX_BYTES) break;
      out = await encode(bitmap, a.edge, a.quality);
    }
    return out;
  } finally {
    bitmap.close();
  }
}
