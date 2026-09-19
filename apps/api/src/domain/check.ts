import type { Artifact } from "@marketplace/contracts/artifact";
import type { BrandKit } from "@marketplace/contracts/brand-record";
import { contrast } from "./color";

type Slots = Artifact["slots"];
export type Issue = Artifact["check"]["issues"][number];

// Prices come from Offering data only; an amount in copy is invented
const AMOUNT = /[€$£]\s?\d|\d[\d.,]*\s?(€|\$|£|eur\b|euros?\b|usd\b)/i;

function copy(slots: Slots): string {
  return [slots.headline, slots.subline ?? "", slots.body, slots.cta.label].join("\n");
}

export function checkCopy(kit: BrandKit, slots: Slots, colorPairs: [string, string][]): Issue[] {
  const issues: Issue[] = [];
  const text = copy(slots);
  for (const rule of kit.rules) {
    const check = rule.check;
    if (!check) continue;
    const fail = (message: string) => issues.push({ ruleId: rule.id, message, severity: rule.severity });
    switch (check.kind) {
      case "max-length": {
        const value = slots[check.slot] ?? "";
        if (value.length > check.max) fail(`${check.slot} is ${value.length} characters, max ${check.max}`);
        break;
      }
      case "forbidden-term": {
        const found = check.terms.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(text));
        if (found.length) fail(`uses ${found.map((t) => `"${t}"`).join(", ")}`);
        break;
      }
      case "required-text":
        if (!text.includes(check.text)) fail(`must include "${check.text}"`);
        break;
      case "min-contrast": {
        const weak = colorPairs.filter(([fg, bg]) => contrast(fg, bg) < check.ratio);
        if (weak.length) fail(`contrast below ${check.ratio}: ${weak.map((p) => p.join(" on ")).join(", ")}`);
        break;
      }
    }
  }
  if (AMOUNT.test(text)) issues.push({ ruleId: "no-prices-in-copy", message: "copy states a price; prices are shown from the offer data", severity: "block" });
  return issues;
}
