import { extname } from "node:path";
import type { SourceFile } from "../ports/source-packs";

export const MAX_FILES = 40;
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const ALLOWED = new Set([".pdf", ".json", ".csv", ".jpg", ".jpeg", ".png", ".webp"]);
const IMAGES = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const PHOTOS = "photos";

export type Upload = { name: string; bytes: Uint8Array };
export type UploadResult = { files: SourceFile[] } | { problem: { error: string; detail?: string } };

// Browser names carry the drop path; traversal segments never reach disk
function relative(name: string): string {
  return name
    .split(/[\\/]/)
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

// A dropped folder prefixes every file with its own name
function stripCommonRoot(paths: string[]): string[] {
  const root = paths[0]?.split("/")[0];
  if (!root || root === PHOTOS) return paths;
  const prefix = `${root}/`;
  return paths.every((p) => p.startsWith(prefix)) ? paths.map((p) => p.slice(prefix.length)) : paths;
}

// readPack only treats an image as a brand photo under photos/
function place(path: string): string {
  const ext = extname(path).toLowerCase();
  if (!IMAGES.has(ext) || path.startsWith(`${PHOTOS}/`)) return path;
  return `${PHOTOS}/${path.split("/").pop()}`;
}

export function toSourceFiles(uploads: Upload[]): UploadResult {
  const named = uploads
    .map((u) => ({ path: relative(u.name), bytes: u.bytes }))
    .filter((u) => u.path && !u.path.split("/").some((part) => part.startsWith(".")));
  if (!named.length) return { problem: { error: "no_files" } };
  if (named.length > MAX_FILES) return { problem: { error: "too_many_files", detail: `${named.length} files, max ${MAX_FILES}` } };

  const total = named.reduce((sum, u) => sum + u.bytes.byteLength, 0);
  if (total > MAX_TOTAL_BYTES) {
    return { problem: { error: "upload_too_large", detail: `${Math.round(total / 1e6)} MB, max ${MAX_TOTAL_BYTES / 1e6} MB` } };
  }

  const unsupported = named.filter((u) => !ALLOWED.has(extname(u.path).toLowerCase())).map((u) => u.path);
  if (unsupported.length) return { problem: { error: "unsupported_files", detail: unsupported.join(", ") } };

  const paths = stripCommonRoot(named.map((u) => u.path));
  const files = named.map((u, i) => ({ path: place(paths[i]!), bytes: u.bytes }));
  if (!files.some((f) => [".pdf", ".json", ".csv"].includes(extname(f.path).toLowerCase()))) {
    return { problem: { error: "no_brand_documents", detail: "needs at least one pdf, json or csv" } };
  }
  return { files };
}
