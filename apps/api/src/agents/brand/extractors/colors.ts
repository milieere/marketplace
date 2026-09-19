import { z } from "zod";
import { BrandKit } from "@marketplace/contracts/brand-record";
import type { Llm } from "../../../ports/llm";
import { Cite, evidenceFor, type Finding, type Page } from "../findings";
import { grounded, slug } from "../normalize";
import { ask, failed } from "./ask";

const Colors = z.object({
  colors: z.array(
    z.object({
      name: z.string(),
      role: BrandKit.shape.colors.element.shape.role,
      hex: z.string().nullable().describe("only if a hex value is printed, e.g. #C8553D"),
      rgb: z.array(z.number()).length(3).nullable().describe("only if RGB values are printed"),
      cmyk: z.array(z.number()).length(4).nullable().describe("only if CMYK values are printed, in percent"),
      cite: Cite,
    }),
  ),
});

type Role = BrandKit["colors"][number]["role"];
export type PdfColor = { id: string; name: string; role: Role; hex?: string; rgb?: [number, number, number]; cmyk?: [number, number, number, number]; finding: Finding };

// Unprinted values are dropped; conversions happen in code
export async function extractColors(llm: Llm, pages: Page[]): Promise<PdfColor[]> {
  const out = await ask(llm, "colors", Colors, "List every brand colour with its role and the values printed for it. Copy values exactly; do not convert.", pages).catch(failed("colors"));
  return out.colors.map((c) => {
    const id = slug(c.name);
    const evidence = evidenceFor(`brandKit.colors[${id}].hex`, c.cite, pages);
    const page = pages.find((p) => p.documentId === evidence.documentId && p.number === evidence.page)?.text ?? "";
    const printed = (value: string) => grounded(page, value);
    const hex = c.hex && /^#?[0-9A-Fa-f]{6}$/.test(c.hex) && printed(c.hex.replace(/^#?/, "")) ? `#${c.hex.replace(/^#/, "").toUpperCase()}` : undefined;
    return {
      id,
      name: c.name,
      role: c.role,
      hex,
      rgb: c.rgb && printed(c.rgb.join(" ")) ? (c.rgb as [number, number, number]) : undefined,
      cmyk: c.cmyk && printed(c.cmyk.join(" ")) ? (c.cmyk as [number, number, number, number]) : undefined,
      finding: { field: `brandKit.colors[${id}].hex`, value: hex ?? c.cmyk ?? c.rgb, evidence },
    };
  });
}
