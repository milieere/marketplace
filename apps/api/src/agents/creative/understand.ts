import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Intent } from "@marketplace/contracts/intent";
import type { Attributes, Vocabulary } from "@marketplace/contracts/vocabulary";
import { describeLocal, tonight } from "../../domain/time";
import type { Llm } from "../../ports/llm";

const SYSTEM = readFileSync(new URL("../../prompts/understand.md", import.meta.url), "utf8");

const Party = z.object({ size: z.number().int().positive(), kids: z.number().int().nonnegative().nullish(), relation: z.string().nullish() });
const Budget = z.object({ amount: z.number().positive(), per: z.enum(["total", "person"]) });
const Attrs = z.record(z.string(), z.array(z.string()));

export const IntentDraft = z.object({
  scope: z.enum(["in-domain", "out-of-domain", "unclear"]),
  language: z.string(),
  party: Party.nullish(),
  budget: Budget.nullish(),
  phrases: z.array(z.string()).default([]),
  needs: z
    .array(
      z.object({
        label: z.string(),
        kinds: z.array(z.string()).nullish(),
        when: z.object({ start: z.string(), end: z.string().nullish() }).nullish(),
        party: Party.nullish(),
        budget: Budget.nullish(),
        required: Attrs.default({}),
        preferred: Attrs.default({}),
        avoid: Attrs.default({}),
      }),
    )
    .max(3)
    .default([]),
  missing: z.array(z.string()).default([]),
});
export type IntentDraft = z.infer<typeof IntentDraft>;

export type UnderstandInput = { text: string; now: Date; timezone: string; vocabulary: Vocabulary; previousIntent?: Intent };

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?([+-]\d{2}:\d{2}|Z)$/;
const isIso = (s: string | null | undefined): s is string => typeof s === "string" && ISO_WITH_OFFSET.test(s) && !Number.isNaN(Date.parse(s));

function party(p: z.infer<typeof Party> | null | undefined) {
  return p ? { size: p.size, kids: p.kids ?? undefined } : undefined;
}

// Vocabulary is the only value source; unknowns go to `dropped`
function clean(vocabulary: Vocabulary, draft: IntentDraft["needs"][number], dropped: string[]) {
  const out = { required: {} as Attributes, preferred: {} as Attributes, avoid: {} as Attributes };
  for (const list of ["required", "preferred", "avoid"] as const) {
    for (const [key, values] of Object.entries(draft[list])) {
      const def = vocabulary.attributes.find((a) => a.key === key);
      if (!def) {
        dropped.push(`${list}.${key}`);
        continue;
      }
      const target = list === "required" && def.constraint === "soft" ? "preferred" : list;
      for (const value of values) {
        if (!def.values.includes(value)) dropped.push(`${list}.${key}:${value}`);
        else if (!out[target][key]?.includes(value)) (out[target][key] ??= []).push(value);
      }
    }
  }
  return out;
}

export function normalize(draft: IntentDraft, input: UnderstandInput): Intent {
  const { vocabulary, now, timezone } = input;
  const assumed: string[] = [];
  const dropped: string[] = [];
  const inDomain = draft.scope !== "out-of-domain";

  const drafts = inDomain && draft.needs.length === 0 ? [{ label: "outing", required: {}, preferred: {}, avoid: {} }] : draft.needs;
  const needs = inDomain
    ? drafts.map((n, i) => {
        const kinds = n.kinds?.filter((k) => vocabulary.offeringKinds.includes(k) || !dropped.push(`kinds:${k}`));
        let when = isIso(n.when?.start) ? { start: n.when.start, end: isIso(n.when.end) ? n.when.end : undefined } : undefined;
        if (n.when && !when) dropped.push(`when:${n.when.start}`);
        if (!when) {
          when = { start: tonight(now, timezone), end: undefined };
          assumed.push(`needs[n${i + 1}].when: ${describeLocal(when.start, timezone)}`);
        }
        return {
          id: `n${i + 1}`,
          label: n.label,
          kinds: kinds?.length ? kinds : undefined,
          when,
          party: party(n.party),
          budget: n.budget ?? undefined,
          ...clean(vocabulary, n, dropped),
        };
      })
    : [];

  let intentParty = draft.party ? { ...party(draft.party)!, relation: draft.party.relation ?? undefined } : undefined;
  if (inDomain && !intentParty && needs.every((n) => !n.party)) {
    intentParty = { size: 2, kids: undefined, relation: undefined };
    assumed.push("party.size: 2");
  }

  return Intent.parse({
    id: `int-${randomUUID().slice(0, 8)}`,
    raw: { text: input.text, inputs: [{ kind: "text" }] },
    scope: draft.scope,
    language: draft.language,
    party: intentParty,
    budget: draft.budget ?? undefined,
    phrases: draft.phrases,
    needs,
    assumed,
    dropped,
    missing: draft.missing,
  });
}

function vocabularyForPrompt(vocabulary: Vocabulary) {
  return {
    offeringKinds: vocabulary.offeringKinds,
    attributes: vocabulary.attributes
      .filter((a) => a.appliesTo.some((t) => t !== "photo"))
      .map((a) => ({ key: a.key, description: a.description, values: a.values, canBeRequired: a.constraint !== "soft" })),
  };
}

export async function understand(llm: Llm, input: UnderstandInput): Promise<Intent> {
  const context = {
    now: `${tonight(input.now, input.timezone, "00:00")} (${describeLocal(input.now.toISOString(), input.timezone)})`,
    timezone: input.timezone,
    vocabulary: vocabularyForPrompt(input.vocabulary),
    previousIntent: input.previousIntent,
  };
  const draft = await llm
    .structured({ step: "understand", schema: IntentDraft, system: SYSTEM, prompt: `Context:\n${JSON.stringify(context)}\n\nRequest:\n${input.text}` })
    .catch((err: unknown) => {
      throw new Error("Understanding the request failed", { cause: err });
    });
  return normalize(draft, input);
}

export function describeIntent(intent: Intent, timezone: string): string {
  const need = intent.needs[0];
  const party = need?.party ?? intent.party;
  const budget = need?.budget ?? intent.budget;
  const required = intent.needs.flatMap((n) => Object.values(n.required).flat());
  return [
    party && `${party.size} people`,
    need?.when && describeLocal(need.when.start, timezone),
    budget && `budget ${budget.amount} ${budget.per === "person" ? "pp" : "total"}`,
    ...new Set(required),
  ]
    .filter(Boolean)
    .join(" · ");
}
