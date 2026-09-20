import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { BrandRecord } from "@marketplace/contracts/brand-record";
import type { BrandAgent } from "../../agents/brand/brand-agent";
import type { Config } from "../../config";
import { checkBrandRecord } from "../../domain/brand-integrity";
import type { RecordedStreams } from "../../mock/recorded-streams";
import { replay } from "../../mock/replay";
import type { BrandRepository } from "../../ports/brand-repository";
import type { SourcePacks } from "../../ports/source-packs";
import { streamAgentEvents } from "../sse";
import { MAX_FILES, MAX_TOTAL_BYTES, toSourceFiles, type Upload } from "../upload";

// Ingest by id replays a pack already in data/sources; /ingest/upload puts one there first
const IngestRequest = z.object({ brandId: z.string().regex(/^[a-z0-9-]+$/).default("casa-brisa") });

export function brandRoutes(
  config: Config,
  recorded: RecordedStreams | undefined,
  agent: BrandAgent | undefined,
  brands: BrandRepository | undefined,
  sources: SourcePacks | undefined,
) {
  return new Hono()
    .post("/ingest", async (c) => {
      if (recorded) return streamAgentEvents(c, (signal) => replay(recorded.ingest, config.MOCK_SPEED, signal));
      if (!agent) return c.json({ error: "not_implemented" }, 501);
      const body = IngestRequest.safeParse((await c.req.json().catch(() => undefined)) ?? {});
      if (!body.success) return c.json({ error: "invalid_request", details: body.error.issues }, 400);
      return streamAgentEvents(c, (signal) => agent.run(body.data, signal));
    })
    // Uploaded files are written to the pack directory, then ingested like any other pack
    .post(
      "/ingest/upload",
      bodyLimit({ maxSize: MAX_TOTAL_BYTES, onError: (c) => c.json({ error: "upload_too_large", detail: `max ${MAX_TOTAL_BYTES / 1e6} MB` }, 413) }),
      async (c) => {
        if (recorded) return streamAgentEvents(c, (signal) => replay(recorded.ingest, config.MOCK_SPEED, signal));
        if (!agent || !sources) return c.json({ error: "not_implemented" }, 501);
        const form = await c.req.parseBody({ all: true }).catch(() => undefined);
        if (!form) return c.json({ error: "invalid_request", detail: "expected multipart/form-data" }, 400);
        const brandId = typeof form.brandId === "string" ? form.brandId.trim() : "";
        if (!/^[a-z0-9-]+$/.test(brandId)) return c.json({ error: "invalid_brand_id", detail: "lowercase letters, digits and hyphens" }, 400);

        // Counted before any part is read, so a flood never reaches memory
        const parts = Object.values(form).flat().filter((value): value is File => value instanceof File);
        if (parts.length > MAX_FILES) return c.json({ error: "too_many_files", detail: `${parts.length} files, max ${MAX_FILES}` }, 400);
        const uploads: Upload[] = [];
        try {
          for (const file of parts) uploads.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
        } catch (err) {
          console.error(err);
          return c.json({ error: "invalid_request", detail: "could not read the uploaded files" }, 400);
        }

        const result = toSourceFiles(uploads);
        if ("problem" in result) return c.json(result.problem, 400);

        try {
          await sources.save(brandId, result.files);
        } catch (err) {
          console.error(err);
          return c.json({ error: "upload_failed", detail: "could not store the uploaded pack" }, 500);
        }
        return streamAgentEvents(c, (signal) => agent.run({ brandId }, signal));
      },
    )
    // The reviewer posts back the draft it received from /ingest, edits included
    .post("/:id/verify", async (c) => {
      if (!brands) return c.json({ error: "not_implemented" }, 501);
      const body = BrandRecord.safeParse(await c.req.json().catch(() => undefined));
      if (!body.success) return c.json({ error: "invalid_request", details: body.error.issues }, 400);
      const record = { ...body.data, status: "verified" as const };
      if (record.brand.id !== c.req.param("id")) return c.json({ error: "id_mismatch" }, 400);
      const vocabulary = await brands.vocabulary(record.brand.industry).catch(() => undefined);
      if (!vocabulary) return c.json({ error: "unknown_industry", industry: record.brand.industry }, 400);
      const issues = checkBrandRecord(record, vocabulary);
      if (issues.length) return c.json({ error: "invalid_record", issues }, 422);
      try {
        await brands.save(record);
      } catch (err) {
        console.error(err);
        return c.json({ error: "save_failed", detail: "could not store the verified record" }, 500);
      }
      return c.json({ id: record.brand.id, status: record.status, offerings: record.offerings.length });
    });
}
