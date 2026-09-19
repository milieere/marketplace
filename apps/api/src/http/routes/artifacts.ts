import { Hono } from "hono";
import type { ArtifactStore } from "../../ports/artifact-store";

export function artifactRoutes(store: ArtifactStore | undefined) {
  return new Hono().get("/:id", async (c) => {
    const html = await store?.get(c.req.param("id"));
    return html ? c.html(html) : c.json({ error: "not_found" }, 404);
  });
}
