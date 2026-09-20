import { isHiddenPath } from "../../lib/api/brands";

function readFile(entry, path) {
  return new Promise((resolve, reject) => entry.file((file) => resolve({ file, path }), reject));
}

function readDirectory(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function walk(entry, prefix) {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isFile) return [await readFile(entry, path)];

  const reader = entry.createReader();
  const collected = [];
  // readEntries returns at most 100 children per call and an empty batch means the end
  for (;;) {
    const batch = await readDirectory(reader);
    if (!batch.length) return collected;
    for (const child of batch) collected.push(...(await walk(child, path)));
  }
}

// Must run inside the drop handler: the item list is emptied once it returns
export async function filesFromDrop(dataTransfer) {
  const entries = Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);

  if (!entries.length) return withoutHidden(Array.from(dataTransfer.files).map((file) => ({ file, path: file.name })));

  const collected = [];
  for (const entry of entries) collected.push(...(await walk(entry, "")));
  return withoutHidden(collected);
}

export function filesFromInput(fileList) {
  return withoutHidden(Array.from(fileList).map((file) => ({ file, path: file.webkitRelativePath || file.name })));
}

function withoutHidden(entries) {
  return entries.filter((entry) => entry.path && !isHiddenPath(entry.path));
}

export function mergeFiles(current, incoming) {
  const byPath = new Map(current.map((entry) => [entry.path, entry]));
  for (const entry of incoming) byPath.set(entry.path, entry);
  return [...byPath.values()];
}

// A dropped folder prefixes every file with its own name, which is a good guess at the brand
export function commonRoot(entries) {
  const roots = new Set(entries.map((entry) => entry.path.split("/")[0]));
  if (roots.size !== 1) return "";
  const [root] = roots;
  return entries.every((entry) => entry.path.includes("/")) ? root : "";
}
