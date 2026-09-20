import type { BrandKit } from "@marketplace/contracts/brand-record";
import { cardDesign, type CardLayout } from "./card";

export type LogoCorner = "top-left" | "top-right" | "bottom-left" | "top-center";
export type CopyAnchor = "bottom-left" | "bottom-right" | "below-media" | "side-right" | "top-left" | "centre";
export type PriceStyle = "hero" | "editorial" | "inline";

export type EditorialLayout = {
  frame: CardLayout;
  logoCorner: LogoCorner;
  copyAnchor: CopyAnchor;
  align: "left" | "centre";
  showSubline: boolean;
  showBody: boolean;
  showBadges: boolean;
  priceStyle: PriceStyle;
  headlineScale: number;
  scrim: "bottom" | "top" | "left" | "right" | "none";
  rule: boolean;
  stamp: boolean;
};

const BY_COMPOSITION: Record<CardLayout, Pick<EditorialLayout, "logoCorner" | "copyAnchor" | "scrim">> = {
  poster: { logoCorner: "top-left", copyAnchor: "bottom-left", scrim: "bottom" },
  editorial: { logoCorner: "top-center", copyAnchor: "below-media", scrim: "top" },
  split: { logoCorner: "top-right", copyAnchor: "side-right", scrim: "none" },
};

const HEADLINE_SCALE = { airy: 1.15, balanced: 1, dense: 0.85 } as const;

function priceStyleFor(kit: BrandKit): PriceStyle {
  if (kit.style.headlineCase === "upper") return "hero";
  if (kit.style.density === "airy") return "editorial";
  return "inline";
}

// Every brand lands somewhere different without a per-brand table
export function editorialLayout(kit: BrandKit): EditorialLayout {
  const style = kit.style;
  const design = cardDesign(kit);
  const base = BY_COMPOSITION[design.layout];
  const upper = style.headlineCase === "upper";

  return {
    frame: design.layout,
    ...base,
    // A stamp wants the opposite corner from the seal it sits against
    logoCorner: style.ornament === "stamp" && base.logoCorner === "top-left" ? "bottom-left" : base.logoCorner,
    align: style.headlineCase === "title" && design.layout === "editorial" ? "centre" : "left",
    showSubline: style.density !== "dense",
    showBody: style.density === "balanced" || (style.density === "airy" && !upper),
    showBadges: style.density === "dense" || upper,
    priceStyle: priceStyleFor(kit),
    headlineScale: HEADLINE_SCALE[style.density] * (upper ? 1.1 : 1),
    rule: style.ornament === "rule" || style.ornament === "pattern",
    stamp: style.ornament === "stamp",
  };
}
