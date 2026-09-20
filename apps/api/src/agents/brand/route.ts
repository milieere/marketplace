import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Llm } from "../../ports/llm";
import type { Page } from "./findings";

const SYSTEM = readFileSync(new URL("../../prompts/brand-route.md", import.meta.url), "utf8");
const PREVIEW_CHARS = 700;

export const Topic = z.enum(["identity", "logo", "color", "typography", "voice", "imagery", "rules", "location", "offers"]);
export type Topic = z.infer<typeof Topic>;

const Routing = z.object({
  pages: z.array(z.object({ document: z.string(), page: z.number().int(), topics: z.array(Topic) })),
});

export type Router = (topics: Topic[]) => Page[];

const key = (documentId: string, page: number) => `${documentId}#${page}`;

// An unrouted topic falls back to every page: slower, never empty-handed
export async function route(llm: Llm, pages: Page[]): Promise<{ pagesFor: Router; routed: boolean }> {
  const all = () => pages;
  if (!pages.length) return { pagesFor: all, routed: false };
  const previews = pages.map((p) => `=== document ${p.documentId}, page ${p.number} ===\n${p.text.slice(0, PREVIEW_CHARS)}`).join("\n\n");
  const routing = await llm.structured({ step: "route", schema: Routing, system: SYSTEM, prompt: `Pages:\n${previews}` }).catch((err: unknown) => {
    console.error("route failed, extractors read every page", err);
    return undefined;
  });
  if (!routing) return { pagesFor: all, routed: false };

  const topicsByPage = new Map(routing.pages.map((r) => [key(r.document, r.page), new Set(r.topics)]));
  return {
    routed: true,
    pagesFor: (topics) => {
      const hits = pages.filter((p) => topics.some((t) => topicsByPage.get(key(p.documentId, p.number))?.has(t)));
      return hits.length ? hits : pages;
    },
  };
}
