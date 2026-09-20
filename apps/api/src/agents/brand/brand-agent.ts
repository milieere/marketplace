import { BrandRecord, type BrandKit, type Evidence, type Location, type Offering, type Photo } from "@marketplace/contracts/brand-record";
import type { AgentEvent } from "@marketplace/contracts/events";
import { checkBrandRecord } from "../../domain/brand-integrity";
import type { BrandRepository } from "../../ports/brand-repository";
import type { DocumentReader } from "../../ports/document-reader";
import type { Llm } from "../../ports/llm";
import type { SourcePacks } from "../../ports/source-packs";
import { extractColors, type PdfColor } from "./extractors/colors";
import { extractIdentity, type IdentityResult } from "./extractors/identity";
import { extractLocations } from "./extractors/locations";
import { tagPhoto } from "./extractors/photos";
import { extractRules } from "./extractors/rules";
import { extractTypography } from "./extractors/typography";
import { extractVoice } from "./extractors/voice";
import type { Finding } from "./findings";
import { mergeColors, mergeFonts, sameVenue } from "./normalize";
import { readPack } from "./read";
import { route } from "./route";
import { mapOffersCsv, mapTokens, type Tokens } from "./structured";
import { verify } from "./verify";

export type BrandAgentDeps = { llm: Llm; sources: SourcePacks; reader: DocumentReader; brands: BrandRepository; clock?: () => Date };
export type BrandAgent = { run(request: { brandId: string }, signal: AbortSignal): AsyncGenerator<AgentEvent> };

const DEFAULT_STYLE: BrandKit["style"] = { radius: 8, density: "balanced", headlineCase: "sentence", imageTreatment: "full-bleed", composition: "image-top", ornament: "none" };

type Draft = {
  identity?: IdentityResult;
  tokens?: Tokens;
  pdfColors: PdfColor[];
  pdfFonts: BrandKit["typography"];
  voice?: BrandKit["voice"];
  rules: BrandKit["rules"];
  locations: Location[];
  offerings: (Offering & { venue?: string })[];
  photos: Photo[];
  notes: string[];
};

// Yields each task's findings as soon as it settles
async function* settle(tasks: Promise<Finding[]>[]): AsyncGenerator<Finding[]> {
  const pending = new Map(tasks.map((t, i) => [i, t.then((findings) => ({ i, findings }))]));
  while (pending.size) {
    const { i, findings } = await Promise.race(pending.values());
    pending.delete(i);
    yield findings;
  }
}

const finding = (f: Finding): AgentEvent => ({ type: "finding", field: f.field, value: f.value, evidence: f.evidence });

function titleCase(id: string): string {
  return id.replace(/(^|-)(\w)/g, (_, dash: string, c: string) => `${dash ? " " : ""}${c.toUpperCase()}`);
}

export function createBrandAgent({ llm, sources, reader, brands, clock = () => new Date() }: BrandAgentDeps): BrandAgent {
  return {
    async *run({ brandId }, signal) {
      try {
        const files = await sources.load(brandId);
        if (!files?.length) {
          yield { type: "error", message: `No source pack for "${brandId}".` };
          yield { type: "done" };
          return;
        }
        const vocabulary = await brands.vocabulary((await brands.house()).brand.industry);

        const readStep = { type: "step", agent: "brand", id: "read", label: `Reading ${files.length} files` } as const;
        yield { ...readStep, status: "started" };
        const pack = await readPack(brandId, files, reader, clock().toISOString());
        yield { ...readStep, status: "done", detail: pack.summary.join(", ") };

        const routeStep = { type: "step", agent: "brand", id: "route", label: "Sorting pages by topic" } as const;
        yield { ...routeStep, status: "started" };
        const { pagesFor, routed } = await route(llm, pack.pages);
        yield { ...routeStep, status: "done", detail: routed ? undefined : "Couldn't sort pages; every extractor reads everything" };
        if (signal.aborted) return;

        const extractStep = { type: "step", agent: "brand", id: "extract", label: "Extracting colours, type, voice, offers" } as const;
        yield { ...extractStep, status: "started" };
        const draft: Draft = { pdfColors: [], pdfFonts: [], rules: [], locations: [], offerings: [], photos: [], notes: [] };
        const found: Finding[] = [];
        const run = (topic: string, work: () => Promise<Finding[]>) =>
          work().catch((err: unknown) => {
            console.error(`extract ${topic} failed`, err);
            draft.notes.push(`Couldn't extract ${topic}; please fill it in by hand.`);
            return [];
          });
        const hasPdf = pack.pages.length > 0;

        if (pack.tokens) {
          const tokens = mapTokens(pack.tokens.json, pack.tokens.documentId);
          draft.tokens = tokens;
          found.push(...tokens.findings);
        }
        if (pack.offers) {
          const offers = mapOffersCsv(pack.offers.text, pack.offers.documentId, vocabulary);
          draft.offerings = offers.offerings;
          draft.notes.push(...offers.notes);
          found.push(...offers.findings);
        }
        for (const f of found) yield finding(f);

        const tasks = [
          ...(hasPdf
            ? [
                run("brand identity", async () => {
                  draft.identity = await extractIdentity(llm, pagesFor(["identity", "logo", "typography", "imagery"]));
                  return draft.identity.findings;
                }),
                run("colours", async () => {
                  draft.pdfColors = await extractColors(llm, pagesFor(["color"]));
                  return draft.pdfColors.map((c) => c.finding);
                }),
                run("typography", async () => {
                  const t = await extractTypography(llm, pagesFor(["typography"]));
                  draft.pdfFonts = t.fonts;
                  return t.findings;
                }),
                run("tone of voice", async () => {
                  const v = await extractVoice(llm, pagesFor(["voice", "identity"]));
                  draft.voice = v.voice;
                  draft.notes.push(...v.notes);
                  return v.findings;
                }),
                run("rules", async () => {
                  const r = await extractRules(llm, pagesFor(["rules", "logo", "color", "typography", "voice"]));
                  draft.rules = r.rules;
                  return r.findings;
                }),
                run("locations", async () => {
                  const l = await extractLocations(llm, pagesFor(["location"]), brandId, vocabulary);
                  draft.locations = l.locations;
                  draft.notes.push(...l.notes);
                  return l.findings;
                }),
              ]
            : []),
          ...pack.photos.map((photo) =>
            tagPhoto(llm, photo, vocabulary)
              .then((r) => {
                draft.photos.push(r.photo);
                draft.notes.push(...r.notes);
                return [r.finding];
              })
              .catch((err: unknown) => {
                console.error(`tag-photo ${photo.id} failed`, err);
                draft.photos.push({ id: photo.id, url: photo.url, description: titleCase(photo.id), orientation: photo.orientation, attributes: {} });
                draft.notes.push(`Photo ${photo.id} couldn't be tagged; please tag it by hand.`);
                return [];
              }),
          ),
        ];
        for await (const batch of settle(tasks)) {
          if (signal.aborted) return;
          found.push(...batch);
          for (const f of batch) yield finding(f);
        }

        const colorIds = new Set([...(draft.tokens?.colors ?? []), ...draft.pdfColors].map((c) => c.id));
        const fontCount = mergeFonts(draft.tokens?.fonts ?? [], draft.pdfFonts).length;
        yield {
          ...extractStep,
          status: "done",
          detail: `${colorIds.size} colours · ${fontCount} fonts · ${draft.offerings.length} offers · ${draft.locations.length} location${draft.locations.length === 1 ? "" : "s"}`,
        };

        const normalizeStep = { type: "step", agent: "brand", id: "normalize", label: "Normalising values" } as const;
        yield { ...normalizeStep, status: "started" };
        const colors = mergeColors(draft.tokens?.colors ?? [], draft.pdfColors);
        draft.notes.push(...colors.notes);
        for (const c of colors.converted) {
          const source = draft.pdfColors.find((p) => p.id === c.id)!.finding;
          const f: Finding = { field: source.field, value: c.hex, evidence: source.evidence };
          found.push(f);
          yield finding(f);
        }
        const offerings: Offering[] = draft.offerings.map(({ venue, ...o }) => {
          if (!venue) return o;
          const matches = draft.locations.filter((l) => sameVenue(venue, l));
          const location = matches.length === 1 ? matches[0] : undefined;
          if (!location) draft.notes.push(`Offer ${o.id}: venue "${venue}" isn't a known location; offered everywhere for now.`);
          return location ? { ...o, locationIds: [location.id] } : o;
        });
        yield {
          ...normalizeStep,
          status: "done",
          detail: colors.converted.length ? `${colors.converted.length} colour${colors.converted.length === 1 ? "" : "s"} converted from CMYK` : undefined,
        };
        if (signal.aborted) return;

        const verifyStep = { type: "step", agent: "brand", id: "verify", label: "Double-checking uncertain fields" } as const;
        yield { ...verifyStep, status: "started" };
        const verified = await verify(llm, found, pack.pages);
        const notes = [...draft.notes, ...verified.notes];
        yield { ...verifyStep, status: "done", detail: `${verified.checked} re-checked · ${notes.length} item${notes.length === 1 ? "" : "s"} flagged for review` };

        const identity = draft.identity;
        if (!identity) notes.push("Brand name, summary and style need filling in by hand.");
        if (!draft.voice) notes.push("Tone of voice needs filling in by hand.");
        const evidence = [...new Map(verified.findings.map((f) => [`${f.field}|${f.evidence.documentId}|${f.evidence.quote ?? ""}`, f.evidence])).values()];
        const record = BrandRecord.safeParse({
          status: "draft",
          brand: {
            id: brandId,
            industry: vocabulary.industry,
            name: identity?.brand.name ?? titleCase(brandId),
            summary: identity?.brand.summary ?? "",
            languages: identity?.brand.languages.length ? identity.brand.languages : ["en"],
            website: identity?.brand.website,
          },
          brandKit: {
            colors: colors.colors,
            typography: mergeFonts(draft.tokens?.fonts ?? [], draft.pdfFonts),
            logos: [],
            style: identity?.style ?? DEFAULT_STYLE,
            voice: draft.voice ?? { summary: "", toneRange: { formality: [0, 1], energy: [0, 1] }, doSay: [], dontSay: [], samples: [] },
            imagery: identity?.imagery ?? { style: "", avoid: [] },
            photos: [...draft.photos].sort((a, b) => a.id.localeCompare(b.id)),
            rules: draft.rules,
          },
          locations: draft.locations,
          offerings,
          documents: pack.documents,
          evidence: evidence satisfies Evidence[],
          reviewNotes: notes,
        });
        if (!record.success) {
          console.error("brand record invalid", record.error.issues);
          yield { type: "error", message: `Couldn't assemble a valid record: ${record.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
          yield { type: "done" };
          return;
        }
        record.data.reviewNotes.push(...checkBrandRecord(record.data, vocabulary));
        yield { type: "record", record: record.data };
        yield { type: "done" };
      } catch (err) {
        console.error("brand ingest failed", err);
        yield { type: "error", message: `Couldn't read the ${brandId} sources: ${err instanceof Error ? err.message : "unexpected error"}` };
        yield { type: "done" };
      }
    },
  };
}
