// Browser-side image handling for the editor's pict-feed drop zones.
import { IMAGE_EXTENSIONS, MAX_ASSET_BYTES } from "./uplink.js?v=1.2";

export const UPLOAD_AS_IS_BYTES = 5 * 1024 * 1024;
export const LOCAL_MAX_DIMENSION = 1280;
export const LOCAL_MAX_CHARS = 450_000; // keeps an offline data URL to roughly 330 KB
const MATTE = "#020703"; // JPEG has no alpha: transparent pixels become CRT black

export const isImageFile = (file) => Boolean(file && /^image\//i.test(file.type || ""));

// First image from a paste/drop DataTransfer, or null.
export function imageFromTransfer(transfer) {
  if (!transfer) return null;
  for (const file of transfer.files || []) if (isImageFile(file)) return file;
  for (const item of transfer.items || []) {
    if (item.kind === "file" && /^image\//i.test(item.type)) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

// A dragged web image or pasted link: first http(s) URL in the transfer, or "".
export function urlFromTransfer(transfer) {
  const text = (transfer?.getData?.("text/uri-list") || transfer?.getData?.("text/plain") || "").trim();
  return text.split(/\s+/).find((line) => /^https?:\/\/\S+$/i.test(line)) || "";
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file); } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("This file could not be decoded as an image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(source, maxDimension) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = MATTE;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas, type, quality) => new Promise((resolve, reject) =>
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed."))), type, quality));

// Web-friendly files under 5 MB go up untouched (GIFs keep their animation up to the 8 MB cap);
// anything else is re-encoded as JPEG.
export async function prepareForUpload(file) {
  if (!isImageFile(file)) throw new Error("Only image files can be used as pict-feeds.");
  const type = file.type.toLowerCase();
  const ext = IMAGE_EXTENSIONS[type];
  if (ext && (file.size <= UPLOAD_AS_IS_BYTES || (type === "image/gif" && file.size <= MAX_ASSET_BYTES))) {
    return { blob: file, ext, type, recompressed: false };
  }
  const source = await decode(file);
  for (const [dimension, quality] of [[2560, 0.88], [2048, 0.82], [1600, 0.78]]) {
    const blob = await toBlob(draw(source, dimension), "image/jpeg", quality);
    if (blob.size <= UPLOAD_AS_IS_BYTES) return { blob, ext: "jpg", type: "image/jpeg", recompressed: true };
  }
  throw new Error("The image is too large even after compression.");
}

// Offline fallback: a compact JPEG data URL for immediate preview without GitHub.
export async function toCompressedDataUrl(file, { maxDimension = LOCAL_MAX_DIMENSION, maxChars = LOCAL_MAX_CHARS } = {}) {
  if (!isImageFile(file)) throw new Error("Only image files can be used as pict-feeds.");
  const source = await decode(file);
  let dataUrl = "";
  for (let dimension = maxDimension; dimension >= 320; dimension = Math.round(dimension * 0.75)) {
    const canvas = draw(source, dimension);
    for (const quality of [0.8, 0.68, 0.55]) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= maxChars) return dataUrl;
    }
  }
  return dataUrl;
}

export function dataUrlToBytes(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl));
  if (!match) throw new Error("Not a base64 image data URL.");
  const binary = atob(match[2].replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const type = match[1].toLowerCase();
  return { bytes, type, ext: IMAGE_EXTENSIONS[type] || "png" };
}

export const formatBytes = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
