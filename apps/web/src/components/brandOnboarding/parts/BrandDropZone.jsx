"use client";

import { useRef, useState } from "react";
import { commonRoot, filesFromDrop, filesFromInput, mergeFiles } from "../../../features/brand-ingest/dropFiles";
import {
  MAX_FILES,
  MAX_TOTAL_BYTES,
  fileKind,
  formatBytes,
  ingestErrorMessage,
  isBrandId,
  slugify,
  validatePack,
} from "../../../lib/api/brands";
import styles from "../brandOnboarding.module.css";

export default function BrandDropZone({ onStart }) {
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [idEdited, setIdEdited] = useState(false);
  const [files, setFiles] = useState([]);
  const [problem, setProblem] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [packId, setPackId] = useState("");
  const fileInput = useRef(null);
  const folderInput = useRef(null);

  const total = files.reduce((sum, entry) => sum + entry.file.size, 0);

  function rename(value) {
    setName(value);
    if (!idEdited) setBrandId(slugify(value));
  }

  function add(entries) {
    const merged = mergeFiles(files, entries);
    setProblem(null);
    setFiles(merged);
    const root = commonRoot(merged);
    if (root && !name) rename(root.replace(/-/g, " "));
  }

  function remove(path) {
    setProblem(null);
    setFiles((current) => current.filter((entry) => entry.path !== path));
  }

  async function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    add(await filesFromDrop(event.dataTransfer));
  }

  function onPick(event) {
    add(filesFromInput(event.target.files));
    event.target.value = "";
  }

  function submit(event) {
    event.preventDefault();
    const found = validatePack(brandId, files);
    setProblem(found);
    if (!found) onStart({ brandId, files });
  }

  function ingestExisting(event) {
    event.preventDefault();
    const id = packId.trim();
    if (!isBrandId(id)) return setProblem({ error: "invalid_brand_id" });
    onStart({ brandId: id });
  }

  return (
    <div className={styles.dropScreen}>
      <header className={styles.screenHead}>
        <p className={styles.eyebrow}>Agente de marca</p>
        <h1>Sube el material de una marca</h1>
        <p className={styles.lead}>
          Guía de marca, carta de ofertas, ficha de local y fotos. El agente lee los documentos, extrae la marca y te
          devuelve un borrador con la evidencia de cada dato.
        </p>
      </header>

      <form className={styles.dropForm} onSubmit={submit}>
        <div className={styles.identity}>
          <label className={styles.inputLabel} htmlFor="brand-name">
            Nombre de la marca
            <input
              id="brand-name"
              className={styles.input}
              value={name}
              onChange={(event) => rename(event.target.value)}
              placeholder="Casa Brisa"
              autoComplete="off"
            />
          </label>
          <label className={styles.inputLabel} htmlFor="brand-id">
            Identificador
            <input
              id="brand-id"
              className={styles.input}
              value={brandId}
              onChange={(event) => {
                setIdEdited(true);
                setBrandId(event.target.value);
              }}
              placeholder="casa-brisa"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <div
          className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className={styles.dropTitle}>Arrastra aquí una carpeta o un puñado de archivos</p>
          <p className={styles.dropHint}>
            pdf, json, csv, jpg, png o webp · máximo {MAX_FILES} archivos y {MAX_TOTAL_BYTES / 1024 / 1024} MB
          </p>
          <div className={styles.dropActions}>
            <button type="button" className={styles.btnGhost} onClick={() => fileInput.current?.click()}>
              Seleccionar archivos
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => folderInput.current?.click()}>
              Seleccionar carpeta
            </button>
          </div>
          <input ref={fileInput} type="file" multiple hidden onChange={onPick} />
          <input ref={folderInput} type="file" multiple hidden webkitdirectory="" onChange={onPick} />
        </div>

        {files.length > 0 && (
          <div className={styles.fileList}>
            <div className={styles.fileListHead}>
              <span>
                {files.length} archivo{files.length === 1 ? "" : "s"} · {formatBytes(total)}
              </span>
              <button type="button" className={styles.btnLink} onClick={() => setFiles([])}>
                Vaciar
              </button>
            </div>
            <ul>
              {files.map((entry) => {
                const kind = fileKind(entry.path);
                return (
                  <li key={entry.path} className={kind ? undefined : styles.fileBad}>
                    <span className={styles.fileName}>{entry.path}</span>
                    <span className={styles.fileKind}>{kind || "no admitido"}</span>
                    <span className={styles.fileSize}>{formatBytes(entry.file.size)}</span>
                    <button type="button" className={styles.btnLink} onClick={() => remove(entry.path)}>
                      Quitar
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {problem && <p className={styles.formError}>{ingestErrorMessage(problem, 400)}</p>}

        <button type="submit" className={styles.btnPrimary}>
          Extraer la marca
        </button>
      </form>

      <form className={styles.packForm} onSubmit={ingestExisting}>
        <label className={styles.inputLabel} htmlFor="pack-id">
          O vuelve a ingestar un paquete ya subido
          <input
            id="pack-id"
            className={styles.input}
            value={packId}
            onChange={(event) => setPackId(event.target.value)}
            placeholder="casa-brisa"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className={styles.btnGhost}>
          Ingestar
        </button>
      </form>
    </div>
  );
}
