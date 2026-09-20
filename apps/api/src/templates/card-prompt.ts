import { readFileSync } from "node:fs";
import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandKit, BrandRecord, Location, Offering } from "@marketplace/contracts/brand-record";
import {
  ASPECT,
  CASE,
  applyCase,
  cardCurrency,
  cardDesign,
  currencySymbol,
  formatPrice,
  preferredOrientation,
  type CardDesign,
  type CardLayout,
} from "./card";
import { editorialLayout, type EditorialLayout } from "./editorial";

export type FullCardPrompt = {
  system: string;
  prompt: string;
  aspectRatio: (typeof ASPECT)[CardLayout];
  referenceImages: string[];
};

export const FULL_CARD_SYSTEM = readFileSync(new URL("../prompts/card-image.md", import.meta.url), "utf8");

// Delimiters get drawn; JSON syntax does not
function jsonBlock(entries: [string, string][]): string {
  const body = entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v.trim())}`).join(",\n");
  return `{\n${body}\n}`;
}

// Intl puts a narrow no-break space between amount and currency; printed bare it is
// invisible in the prompt and the model silently drops it.
const NAMED: Record<string, string> = {
  "\u00A0": "a no-break space (U+00A0)",
  "\u202F": "a narrow no-break space (U+202F)",
};

// The card wants one line, not the full paragraph; take a whole sentence, never a cut
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?=\s|$)/u);
  return (match?.[0] ?? text).trim();
}

function exotic(strings: string[]): string[] {
  const found = [...new Set(strings.join("").match(/[^\x00-\x7F]/gu) ?? [])];
  return found.map((c) => NAMED[c] ?? c);
}

function offeringsOf(record: BrandRecord, artifact: Artifact): Offering[] {
  const ids = new Set(artifact.offeringIds);
  return record.offerings.filter((o) => ids.has(o.id));
}

function attributeList(attributes: Record<string, string[]> | undefined): string {
  const entries = Object.entries(attributes ?? {}).filter(([, v]) => v.length);
  return entries.map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ") || "none";
}

// Sizes and insets are given as words: a bare "7%" or "14px" in the prompt gets
// typeset onto the card as if it were copy.
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"] as const;
const count = (n: number) => COUNT[n] ?? String(n);

type Recipe = { subline: boolean; body: boolean; place: boolean; priceStyle: "hero" | "editorial" | "quiet"; voice: string };

// Element mix comes from the brand's own density and case, so two brands never
// reduce to the same card
const RECIPE: Record<string, Recipe> = {
  "airy-upper": { subline: false, body: false, place: true, priceStyle: "hero", voice: "a bold poster: one huge line, one number, acres of space" },
  "airy-other": { subline: true, body: false, place: true, priceStyle: "editorial", voice: "an unhurried editorial page: generous space, quiet confidence" },
  "balanced-upper": { subline: true, body: false, place: true, priceStyle: "hero", voice: "a confident advertising banner: strong headline, price that shouts" },
  "balanced-other": { subline: true, body: true, place: true, priceStyle: "editorial", voice: "a warm magazine advert: a headline, a line of copy, a price set with care" },
  "dense-upper": { subline: false, body: false, place: false, priceStyle: "hero", voice: "a loud street poster: headline and price, packed, nothing else" },
  "dense-other": { subline: true, body: false, place: true, priceStyle: "quiet", voice: "a busy listing: tight stack, small type, lots packed in" },
};

const recipeFor = (kit: BrandKit): Recipe =>
  RECIPE[`${kit.style.density}-${kit.style.headlineCase === "upper" ? "upper" : "other"}`]!;

const PRICE_TREATMENT = {
  hero: "The price is the second loudest thing on the card after the headline: set the amount very large in the display face, on its own, with no label and no rule above it.",
  editorial: "Set the price as one quiet editorial line in the display face, the offer name small beside or above it, no table, no rule, no box.",
  quiet: "Set the price small and matter-of-fact at the foot of the stack, the offer name beside it, no rule and no box.",
} as const;

const WEIGHT_WORD = (w: number) => (w >= 700 ? "bold" : w >= 600 ? "semibold" : w >= 500 ? "medium" : "regular");

const MARGIN = { airy: "generous", balanced: "comfortable", dense: "tight" } as const;
const TRACKING_WORD = { upper: "slightly open", title: "normal", sentence: "slightly tight" } as const;
const MARK_TRACKING_WORD = { upper: "widely spaced", title: "open", sentence: "open" } as const;

const ENERGY = [
  "still and unhurried: calm framing, soft light, generous empty space, nothing in motion",
  "measured: natural framing and comfortable spacing, neither sleepy nor frantic",
  "high: a tight dynamic crop, strong contrast, a frame that feels busy and alive",
] as const;
const FORMALITY = [
  "informal: candid and warm, slightly asymmetric, nothing posed",
  "relaxed but composed: natural, tidy, unforced",
  "formal: composed and symmetrical, restrained, every element aligned",
] as const;
function band(value: number): 0 | 1 | 2 {
  if (value < 0.4) return 0;
  if (value < 0.7) return 1;
  return 2;
}

function layoutBlock(d: CardDesign, kit: BrandKit, margin: string): string {
  const p = d.palette;
  const frame = d.framed
    ? `, inset from the edges it meets by a ${margin} margin, with a hairline ${d.surface.fg} border at about a third opacity and slightly rounded corners`
    : ", edge to edge";
  if (d.layout === "poster") {
    return `- The photograph fills the entire frame.
- Brand mark and wordmark lockup at the top left, set in from the top and left edges by a ${margin} margin.
- Copy stack at the bottom left, set in from the left, right and bottom edges by a ${margin} margin, left aligned, in this exact order top to bottom: headline first and dominant, then the remaining listed elements arranged for impact.
- A scrim keeps the copy readable: solid ${p.deep} along the bottom edge, fading through a faint ${p.primary} wash across the middle, fully transparent by the upper fifth. A soft ${p.deep} shade also covers the top band behind the lockup.
- Crop the photograph so its main subject sits in the upper half of the frame, clear of the copy.`;
  }
  if (d.layout === "editorial") {
    return `- Two stacked bands, no gap between them.
- Top band, a little under half the frame height: the photograph across the full width${frame}.
- Bottom band: a solid ${d.surface.bg} panel filling the rest of the frame, contents set in on all sides by a ${margin} margin, left aligned, top to bottom: brand mark and wordmark lockup, headline first and dominant, then the remaining listed elements arranged for impact.`;
  }
  return `- Two full-height columns, no gap.
- Left column, a little under half the frame width: the photograph${frame}.
- Right column, the wider one: a solid ${d.surface.bg} panel, contents set in by a ${margin} margin, vertically centred, left aligned, top to bottom: brand mark and wordmark lockup, headline first and dominant, then the remaining listed elements arranged for impact.`;
}

function treatmentBlock(kit: BrandKit, d: CardDesign): string {
  const p = d.palette;
  if (kit.style.imageTreatment === "duotone") {
    return `Reduce the photograph to two tones only: shadows ${p.accent}, highlights ${p.primary}, smooth mapping in between, slightly raised contrast. No other hue survives inside the photographic area.`;
  }
  if (kit.style.imageTreatment === "framed") {
    return "The photograph sits inside its frame as described under LAYOUT, cropped to fill that inset rectangle.";
  }
  return "The photograph fills its area completely, cropped to fill, never letterboxed, never padded.";
}

function ornamentBlock(kit: BrandKit, d: CardDesign, margin: string): string {
  const p = d.palette;
  switch (kit.style.ornament) {
    case "rule":
      return `A short solid ${d.onSurfaceAccent} bar, about a third of the frame width and a few strokes thick, sits directly below the headline with a small gap. A thin ${d.onSurfaceAccent} underline runs the full width of the wordmark, just below it. Neither is a container: nothing sits inside them.`;
    case "pattern":
      return `A dashed ${d.onSurfaceAccent} underline, short dashes with small gaps, runs the full width of the wordmark. Even faint diagonal stripes in ${d.onSurfaceAccent} overlay the upper part of the photographic area only.`;
    case "stamp":
      return `Top right of the photographic area, set in by a ${margin} margin, a circular seal roughly a sixth of the frame width across: ${p.accent} fill, a thin ${p.onAccent} ring, tilted slightly anticlockwise, containing the seal text listed in TEXT TO SET, centred on at most two lines, display face, all capitals, wide letter-spacing, in ${p.onAccent}.`;
    default:
      return "No ornament. Nothing decorative beyond the elements already listed.";
  }
}

export function buildFullCardPrompt(input: { artifact: Artifact; record: BrandRecord }): FullCardPrompt {
  const { artifact, record } = input;
  const kit = record.brandKit;
  const style = kit.style;
  const d = cardDesign(kit);
  const p = d.palette;
  const margin = MARGIN[style.density];

  const language = artifact.language;
  const currency = cardCurrency(record, artifact.priceLines);
  const location: Location | undefined = record.locations.find((l) => l.id === artifact.locationId);
  const offerings = offeringsOf(record, artifact);
  const photo = artifact.presentation?.photo;
  const tagged = kit.photos.find((x) => x.id === artifact.photoId);

  const display = kit.typography.find((t) => t.role === "display") ?? kit.typography[0]!;
  const body = kit.typography.find((t) => t.role === "body") ?? display;

  const recipe = recipeFor(kit);
  const headline = applyCase(artifact.slots.headline, style.headlineCase);
  const bodyLine = firstSentence(artifact.slots.body);
  const level = location?.priceLevel ? currencySymbol(currency, language).repeat(location.priceLevel) : undefined;
  const seal = style.ornament === "stamp" ? (kit.voice.doSay[0] ?? "") : "";
  const prices = artifact.priceLines.map((line) => ({ label: line.label, amount: formatPrice(line, currency, language) }));

  const offerName = prices[0]!.label;
  const sublineText = artifact.slots.subline ?? "";
  const showSubline = recipe.subline && Boolean(sublineText) && !sublineText.includes(offerName);
  const showBody = recipe.body;
  const showPlace = recipe.place && Boolean(location);
  const shown = [
    headline,
    showSubline ? sublineText : "",
    showBody ? bodyLine : "",
    showPlace ? location!.name : "",
    level ?? "",
    seal,
    ...prices.flatMap((r) => [r.label, r.amount]),
  ].filter(Boolean);

  const entries: [string, string][] = [
    ["headline", headline],
    ...(showSubline ? ([["subline", sublineText]] as [string, string][]) : []),
    ...(showBody ? ([["line", bodyLine]] as [string, string][]) : []),
    ...(showPlace ? ([["place", location!.name]] as [string, string][]) : []),
    ...(level ? ([["priceLevel", level]] as [string, string][]) : []),
    ["offer", offerName],
    ["price", prices[0]!.amount],
    ...(seal ? ([["seal", seal]] as [string, string][]) : []),
  ];

  const allStrings = shown;
  const nonAscii = exotic(allStrings);

  const photoBlock = photo
    ? `Image 1 is ${record.brand.name}'s own photograph of their real venue, showing: ${photo.alt}.
- You may crop, scale, straighten and colour-grade it, and apply the treatment described under IMAGE TREATMENT.
- You may not replace the scene, substitute a different photograph, regenerate it, or add, remove or relocate people, food, furniture, plants, signage or architecture that are not already in it.
- Its native orientation is ${photo.orientation}; crop it to fill the media area described under LAYOUT. The preferred crop for this brand is ${preferredOrientation(kit)}.
- What the frame should favour: ${attributeList(tagged?.attributes)}.`
    : `PHOTOGRAPH — none supplied; shoot it.
Create the photograph yourself, occupying the media area described under LAYOUT: ${kit.imagery.style}. Subject: ${offerings[0]?.description ?? record.brand.summary}. Location: ${location?.name ?? record.brand.name}. Editorial, natural light, no text or signage of any kind inside the photograph.`;

  // The real mark is composited afterwards; a drawn one is different every run
  const markBlock = `Draw NO logo, mark, emblem, monogram, symbol and NO brand name anywhere in the image. The brand lockup is applied afterwards.
Leave the top band of the card visually clear for it: keep that strip free of faces, text, busy detail and hard edges, so a mark placed there stays legible. A gentle darkening or a plain colour field in that strip is welcome.`;

  const prompt = `Art-direct one advertising banner for this brand, as a single flat image.\n\nThe feel: ${recipe.voice}.

Language: ${language}. ${record.brand.name} communicates in ${record.brand.languages.join(", ")}. All copy below is already written in ${language}. Do not translate it.

CANVAS
- Portrait card artwork in a ${ASPECT[d.layout]} frame, square corners, no bleed beyond the card.
- The card fills the frame completely. There is no background behind it.

REFERENCE PHOTOGRAPH
${photoBlock}

BRAND MARK
${markBlock}

TEXT TO SET
${jsonBlock(entries)}

Render only the VALUES above, exactly as written. Never render a key, a quotation
mark, a brace, a colon or a comma from that block. Set them as an advertisement
would: a dominant headline, the rest placed for impact, never stacked like a form.

${PRICE_TREATMENT[recipe.priceStyle]}

${nonAscii.length ? `The only non-ASCII characters used anywhere above are: ${nonAscii.join(" ")}. Each must appear exactly as shown, in every place it occurs.` : "Every string above is plain ASCII."}
No further price row, no badges or tags, no button, no further line of any kind.

LAYOUT — ${d.layout}
${layoutBlock(d, kit, margin)}

TYPE
- Display face: ${display.family} (nearest category: ${display.fallback}), ${WEIGHT_WORD(Math.max(...display.weights))}. Used for the headline and the price.
- Body face: ${body.family} (nearest category: ${body.fallback}), ${WEIGHT_WORD(Math.min(...body.weights))} for the line of copy and ${WEIGHT_WORD(Math.max(...body.weights))} for the subline, place and offer name.
- If an exact face is unavailable, substitute the closest equivalent with the same stroke contrast, x-height and proportions, and use that same substitute for every occurrence on the card. Do not mix substitutes.
- The headline dominates: it should be unmissable at a glance, several times the size of anything else.
- ${recipe.priceStyle === "hero" ? "The price amount comes next in size, large enough to read across a room." : "The price sits quietly below the headline, refined rather than loud."}
- Everything else is small and secondary. Vary the sizes boldly; an even, uniform text size reads as a document, not an advert.
- Headline: ${CASE[style.headlineCase] === "none" ? "set as given" : CASE[style.headlineCase]}, ${TRACKING_WORD[style.headlineCase]} letter-spacing, tight leading, at most three lines, balanced line lengths, left aligned, ragged right.
- Legibility floor: every character must be crisp and fully readable when this card is viewed at phone width. If copy will not fit, add a line — never shrink it below that, never crop, never abbreviate.

COLOUR — use these hex values exactly. No other flat colour appears.
- Copy surface ${d.surface.bg}; all copy on it ${d.surface.fg}.
- Headline and price at full strength; everything else softened so the hierarchy is obvious.
- Place row: a small solid map-pin glyph in ${d.surface.fg} immediately left of the place name, roughly cap height.${level ? ` Price-level marks in ${d.levelColor}, display face, right-aligned on the same row.` : ""}
- No hairlines, rules, dividers, boxes, panels or table rows anywhere. Elements are separated by space alone.
- Ornament and rules: ${d.onSurfaceAccent}.
- The photograph keeps its own natural colour, except as IMAGE TREATMENT says.

IMAGE TREATMENT — ${style.imageTreatment}
${treatmentBlock(kit, d)}

ORNAMENT — ${style.ornament}
${ornamentBlock(kit, d, margin)}

ART DIRECTION
- The brand: ${record.brand.summary}
- House voice: ${kit.voice.summary}
- The writing sounds like this, so the picture should feel the same: ${kit.voice.samples.map((x) => `"${x}"`).join(" ")}
- Lean into: ${kit.voice.doSay.join(", ")}. Never evoke: ${kit.voice.dontSay.join(", ")}.
- Photography: ${kit.imagery.style}
- Energy: ${ENERGY[band(artifact.tone.energy)]}.
- Formality: ${FORMALITY[band(artifact.tone.formality)]}.
${location ? `- The venue: ${attributeList(location.attributes as Record<string, string[]>)}.` : ""}
${offerings.length ? `- What is on offer: ${offerings.map((o) => `${o.name} — ${o.description}`).join(" | ")}` : ""}
- Never show: ${kit.imagery.avoid.join(", ")}.

BRAND RULES — the brand's own written rules. Respect every one.
${kit.rules.map((r) => `- ${r.text}`).join("\n")}`;

  return {
    system: FULL_CARD_SYSTEM,
    prompt,
    aspectRatio: ASPECT[d.layout],
    referenceImages: photo?.src ? [photo.src] : [],
  };
}

export type ScenePrompt = { prompt: string; aspectRatio: (typeof ASPECT)[CardLayout]; referenceImages: string[] };

// Scene-only: the copy, mark and price are real DOM, so the model draws none of it
export function buildScenePrompt(input: { artifact: Artifact; record: BrandRecord }): ScenePrompt {
  const { artifact, record } = input;
  const kit = record.brandKit;
  const d = cardDesign(kit);
  const layout = editorialLayout(kit);
  const photo = artifact.presentation?.photo;
  const tagged = kit.photos.find((x) => x.id === artifact.photoId);
  const offerings = offeringsOf(record, artifact);
  const location = record.locations.find((l) => l.id === artifact.locationId);

  const clear = CLEAR_SPACE[layout.copyAnchor];
  const scene = photo
    ? `Use the attached photograph as the scene. Crop, scale, straighten and colour-grade it; do not replace it, regenerate it, or add or remove people, food, furniture or architecture.
What the frame should favour: ${attributeList(tagged?.attributes)}.`
    : `Shoot the scene yourself: ${kit.imagery.style}. Subject: ${offerings[0]?.description ?? record.brand.summary}. Place: ${location?.name ?? record.brand.name}.`;

  return {
    prompt: `A single photographic image for a ${record.brand.name} advertisement. No card, no layout, no frame, no poster, no typography — just the picture that will sit behind a real HTML brand layer.

${scene}

Grade and mood
- ${kit.imagery.style}
- The brand reads as: ${kit.voice.summary}
- ${ENERGY[band(artifact.tone.energy)]}
- ${FORMALITY[band(artifact.tone.formality)]}
- Let the brand's own colours sit naturally in the lighting and props only: ${d.palette.primary} and ${d.palette.accent} against ${d.palette.deep}. Do not create flat colour panels; those are rendered later from the brand kit.
- ${TREATMENT[kit.style.imageTreatment](d)}
- Never show: ${kit.imagery.avoid.join(", ")}.

Composition
- Aspect ratio ${ASPECT[d.layout]}.
- ${clear} Keep that area quiet: no faces, no busy detail, no hard edges, so type laid over it stays readable.
- Put the subject in the remaining space and let it breathe.

Absolutely no text, letters, numbers, words, signage, menus, labels, price tags, logos, emblems, brand marks, monograms, watermarks, buttons, badges, cards, frames or UI of any kind anywhere in the image. A photograph only.`,
    aspectRatio: ASPECT[d.layout],
    referenceImages: photo?.src ? [photo.src] : [],
  };
}

const CLEAR_SPACE: Record<EditorialLayout["copyAnchor"], string> = {
  "bottom-left": "Leave the lower third clear and darker.",
  "bottom-right": "Leave the lower third clear and darker.",
  "below-media": "Leave the lower quarter clear; the copy sits under the picture.",
  "side-right": "Leave the right half clear; the copy sits beside the picture.",
  "top-left": "Leave the upper third clear and darker.",
  centre: "Leave a calm band across the middle.",
};

const TREATMENT: Record<BrandKit["style"]["imageTreatment"], (d: CardDesign) => string> = {
  "full-bleed": () => "Natural colour, rich and full-frame.",
  framed: () => "Clean and evenly lit, it will sit inside a frame.",
  duotone: (d) => `Two tones only: shadows ${d.palette.accent}, highlights ${d.palette.primary}.`,
};
