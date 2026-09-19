import { basename, extname } from "node:path";
import type { Photo, SourceDocument } from "@marketplace/contracts/brand-record";
import type { DocumentReader } from "../../ports/document-reader";
import type { SourceFile } from "../../ports/source-packs";
import type { Page } from "./findings";
import { slug } from "./normalize";

const IMAGE_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
export const PHOTOS_DOCUMENT = "doc-photos";

export type PackPhoto = { id: string; url: string; data: Uint8Array; mediaType: string; orientation: Photo["orientation"] };

export type Pack = {
  documents: SourceDocument[];
  pages: Page[];
  tokens?: { documentId: string; json: unknown };
  offers?: { documentId: string; text: string };
  photos: PackPhoto[];
  summary: string[];
};

// Reads width/height from PNG IHDR or a JPEG SOF segment
export function imageSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (view.getUint16(0) !== 0xffd8) return undefined;
  for (let i = 2; i + 9 < bytes.length; ) {
    if (bytes[i] !== 0xff) return undefined;
    const marker = bytes[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }
    i += 2 + view.getUint16(i + 2);
  }
  return undefined;
}

function orientation(bytes: Uint8Array): Photo["orientation"] {
  const size = imageSize(bytes);
  if (!size) return "landscape";
  const ratio = size.width / size.height;
  return ratio > 1.1 ? "landscape" : ratio < 0.9 ? "portrait" : "square";
}

export async function readPack(brandId: string, files: SourceFile[], reader: DocumentReader, addedAt: string): Promise<Pack> {
  const pack: Pack = { documents: [], pages: [], photos: [], summary: [] };
  const doc = (path: string, kind: SourceDocument["kind"]) => {
    const document = { id: `doc-${slug(basename(path, extname(path)))}`, kind, uri: `data/sources/${brandId}/${path}`, addedAt };
    pack.documents.push(document);
    return document.id;
  };

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    try {
      const ext = extname(file.path).toLowerCase();
      const name = basename(file.path);
      if (ext === ".pdf") {
        const documentId = doc(file.path, "pdf");
        const pages = await reader.pages(file.bytes);
        pack.pages.push(...pages.map((p) => ({ documentId, number: p.number, text: p.text })));
        pack.summary.push(`${name} (${pages.length} pages)`);
      } else if (ext === ".json") {
        pack.tokens = { documentId: doc(file.path, "json"), json: JSON.parse(new TextDecoder().decode(file.bytes)) };
        pack.summary.push(name);
      } else if (ext === ".csv") {
        pack.offers = { documentId: doc(file.path, "csv"), text: new TextDecoder().decode(file.bytes) };
        pack.summary.push(name);
      } else if (IMAGE_TYPES[ext] && file.path.startsWith("photos/")) {
        const id = slug(basename(file.path, ext));
        pack.photos.push({ id, url: `/assets/${brandId}/${file.path}`, data: file.bytes, mediaType: IMAGE_TYPES[ext]!, orientation: orientation(file.bytes) });
      }
    } catch (err) {
      throw new Error(`Cannot read ${file.path}`, { cause: err });
    }
  }
  if (pack.photos.length) {
    pack.documents.push({ id: PHOTOS_DOCUMENT, kind: "image", uri: `data/sources/${brandId}/photos/`, addedAt });
    pack.summary.push(`${pack.photos.length} photos`);
  }
  return pack;
}
