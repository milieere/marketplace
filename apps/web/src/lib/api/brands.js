import { AgentEvent } from "@marketplace/contracts/events";
import { getApiUrl } from "./generate";

export const MAX_FILES = 40;
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const KIND_BY_EXTENSION = {
  pdf: "pdf",
  json: "json",
  csv: "csv",
  jpg: "imagen",
  jpeg: "imagen",
  png: "imagen",
  webp: "imagen",
};

const DOCUMENT_EXTENSIONS = new Set(["pdf", "json", "csv"]);

export function extensionOf(path) {
  const name = path.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function fileKind(path) {
  return KIND_BY_EXTENSION[extensionOf(path)] || null;
}

// The API drops dotfiles before it validates, so a macOS folder drop must not trip on .DS_Store
export function isHiddenPath(path) {
  return path.split("/").some((part) => part.startsWith("."));
}

export function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isBrandId(value) {
  return /^[a-z0-9-]+$/.test(value);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Mirrors apps/api/src/http/upload.ts so the common rejections never reach the network
export function validatePack(brandId, files) {
  if (!isBrandId(brandId)) return { error: "invalid_brand_id" };
  if (!files.length) return { error: "no_files" };
  if (files.length > MAX_FILES) return { error: "too_many_files", detail: `${files.length} archivos` };

  const total = files.reduce((sum, entry) => sum + entry.file.size, 0);
  if (total > MAX_TOTAL_BYTES) return { error: "upload_too_large", detail: formatBytes(total) };

  const unsupported = files.filter((entry) => !fileKind(entry.path)).map((entry) => entry.path);
  if (unsupported.length) return { error: "unsupported_files", detail: unsupported.join(", ") };

  if (!files.some((entry) => DOCUMENT_EXTENSIONS.has(extensionOf(entry.path)))) return { error: "no_brand_documents" };
  return null;
}

const INGEST_MESSAGES = {
  invalid_brand_id: "El identificador de marca sólo admite minúsculas, dígitos y guiones.",
  unsupported_files: "Hay archivos con un formato que el agente no lee. Se admiten pdf, json, csv, jpg, jpeg, png y webp.",
  too_many_files: `Demasiados archivos: el máximo es ${MAX_FILES}.`,
  no_brand_documents: "El paquete sólo trae imágenes. Añade al menos un pdf, json o csv con la guía de marca.",
  no_files: "No has añadido ningún archivo.",
  invalid_request: "El servidor no pudo leer el envío.",
  upload_too_large: `El paquete supera el máximo de ${MAX_TOTAL_BYTES / 1024 / 1024} MB.`,
  upload_failed: "El servidor no pudo guardar el paquete.",
  not_implemented: "La API está arrancada sin el agente de marca.",
};

const VERIFY_MESSAGES = {
  invalid_request: "El registro no cumple el esquema.",
  id_mismatch: "El identificador de la ruta no coincide con el de la marca.",
  unknown_industry: "No hay vocabulario para ese sector.",
  invalid_record: "El registro no pasa las comprobaciones de coherencia.",
  save_failed: "El servidor no pudo guardar el registro verificado.",
};

function zodIssues(payload) {
  if (!Array.isArray(payload?.details)) return [];
  return payload.details.map((issue) => `${(issue.path || []).join(".") || "registro"}: ${issue.message}`);
}

export function ingestErrorMessage(payload, status) {
  const base = INGEST_MESSAGES[payload?.error] || `La ingesta falló (HTTP ${status}).`;
  return payload?.detail ? `${base} (${payload.detail})` : base;
}

export function verifyErrorMessage(payload, status) {
  const base = VERIFY_MESSAGES[payload?.error] || `La verificación falló (HTTP ${status}).`;
  if (payload?.error === "unknown_industry" && payload.industry) return `${base} (${payload.industry})`;
  const issues = zodIssues(payload);
  return issues.length ? `${base} ${issues.join(" · ")}` : base;
}

function readDataLine(block) {
  return block
    .split("\n")
    .find((line) => line.startsWith("data:"))
    ?.slice("data:".length)
    .trim();
}

// A fetch that never resolves means the API is down; the browser only says "Failed to fetch"
function transportError(error, signal) {
  if (signal?.aborted) return error;
  return Object.assign(new Error(`No se pudo contactar con la API en ${getApiUrl()}.`), { cause: error });
}

async function readEventStream(body, onEvent) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;

      buffer += value;
      let end = buffer.indexOf("\n\n");

      while (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);

        const data = readDataLine(block);
        if (data) onEvent?.(AgentEvent.parse(JSON.parse(data)));

        end = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Rejections come back as JSON with a status; only a 2xx is an event stream
async function postStream(path, { body, headers, signal, onEvent }) {
  let response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, { method: "POST", body, headers, signal });
  } catch (error) {
    throw transportError(error, signal);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw Object.assign(new Error(ingestErrorMessage(payload, response.status)), { status: response.status, payload });
  }
  if (!response.body) throw new Error("La ingesta respondió sin stream.");

  return readEventStream(response.body, onEvent);
}

export function ingestUpload({ brandId, files }, { signal, onEvent } = {}) {
  const body = new FormData();
  body.set("brandId", brandId);
  // The third argument carries the drop path; file.name alone would flatten a folder
  for (const { file, path } of files) body.append("files", file, path);
  return postStream("/v1/brands/ingest/upload", { body, signal, onEvent });
}

export function ingestPack(brandId, { signal, onEvent } = {}) {
  return postStream("/v1/brands/ingest", {
    body: JSON.stringify({ brandId }),
    headers: { "content-type": "application/json" },
    signal,
    onEvent,
  });
}

export async function verifyBrand(record, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${getApiUrl()}/v1/brands/${encodeURIComponent(record.brand.id)}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
      signal,
    });
  } catch (error) {
    throw transportError(error, signal);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(verifyErrorMessage(payload, response.status)), { status: response.status, payload });
  }
  return payload;
}
