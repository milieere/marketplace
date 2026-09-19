import { z } from "zod";
import { BrandRule, RuleCheck } from "@marketplace/contracts/brand-record";
import type { Llm } from "../../../ports/llm";
import { Cite, evidenceFor, type Finding, type Page } from "../findings";
import { slug } from "../normalize";
import { ask, failed } from "./ask";

const Rules = z.object({
  rules: z.array(
    z.object({
      text: z.string().describe("the rule as one short imperative sentence"),
      severity: BrandRule.shape.severity.describe("block if breaking it must stop publication, warn otherwise"),
      check: RuleCheck.nullable().describe("only when the rule can be checked mechanically on ad copy or colours"),
      cite: Cite,
    }),
  ),
});

export type RulesResult = { rules: BrandRule[]; findings: Finding[] };

export async function extractRules(llm: Llm, pages: Page[]): Promise<RulesResult> {
  const out = await ask(
    llm,
    "rules",
    Rules,
    "List the brand rules for ads: every never/always/must/don't instruction, including those in captions and small print.",
    pages,
  ).catch(failed("rules"));
  const ids = new Set<string>();
  const rules = out.rules.map((r) => {
    let id = slug(r.text).split("-").slice(0, 5).join("-") || "rule";
    while (ids.has(id)) id += "-2";
    ids.add(id);
    return { id, text: r.text, check: r.check ?? undefined, severity: r.severity };
  });
  return {
    rules,
    findings: out.rules.map((r, i) => ({ field: "brandKit.rules", value: rules[i]!.text, evidence: evidenceFor("brandKit.rules", r.cite, pages) })),
  };
}
