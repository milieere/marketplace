import type { Relaxation } from "@marketplace/contracts/artifact";
import type { BrandRecord, Location, Offering } from "@marketplace/contracts/brand-record";
import type { Intent, Need } from "@marketplace/contracts/intent";
import type { Attributes, Vocabulary } from "@marketplace/contracts/vocabulary";
import { budgetLimit, totalCost } from "./cost";
import { isAvailable, isOpen } from "./time";

export type Candidate = { offering: Offering; cost: number; score: number; relaxed: Relaxation[] };
export type BrandMatch = { record: BrandRecord; location?: Location; offerings: Candidate[]; score: number };
export type Exclusion = { brandId: string; reason: string };
export type NeedMatch = { needId: string; matches: BrandMatch[]; excluded: Exclusion[]; closest: boolean };

const CLOSEST_BUDGET_FACTOR = 1.2;

type Rules = { required: Attributes; dropped: Attributes; budgetFactor: number };
type Outcome = { candidate: Candidate; location?: Location } | { failedAt: number; reason: string };

function merge(a: Attributes, b: Attributes = {}): Attributes {
  const out: Attributes = { ...a };
  for (const [key, values] of Object.entries(b)) out[key] = [...new Set([...(out[key] ?? []), ...values])];
  return out;
}

function pairs(attributes: Attributes): [string, string][] {
  return Object.entries(attributes).flatMap(([key, values]) => values.map((v): [string, string] => [key, v]));
}

function has(attributes: Attributes, key: string, value: string): boolean {
  return attributes[key]?.includes(value) ?? false;
}

// "Where" before "what": drop place-only attributes, never food or safety
function closestRules(need: Need, vocabulary: Vocabulary): Rules {
  const droppable = new Set(
    vocabulary.attributes.filter((a) => a.relaxable && !a.appliesTo.includes("offering")).map((a) => a.key),
  );
  const required: Attributes = {};
  const dropped: Attributes = {};
  for (const [key, values] of Object.entries(need.required)) (droppable.has(key) ? dropped : required)[key] = values;
  return { required, dropped, budgetFactor: CLOSEST_BUDGET_FACTOR };
}

function evaluate(intent: Intent, need: Need, record: BrandRecord, offering: Offering, location: Location | undefined, rules: Rules): Outcome {
  const attributes = merge(offering.attributes, location?.attributes);
  const party = need.party ?? intent.party;
  const people = party?.size ?? 1;
  const budget = need.budget ?? intent.budget;
  const cost = totalCost(offering, people, need.when);
  const limit = budget && budgetLimit(budget, people);
  const { min, max } = offering.partySize ?? {};

  const checks: (() => string | undefined)[] = [
    () => (need.brandIds.length && !need.brandIds.includes(record.brand.id) ? "not one of the requested brands" : undefined),
    () => (need.kinds?.length && !need.kinds.includes(offering.kind) ? `no ${need.kinds.join("/")} offer` : undefined),
    () => {
      const missing = pairs(rules.required).filter(([k, v]) => !has(attributes, k, v));
      return missing.length ? `missing ${missing.map(([k, v]) => `${k}:${v}`).join(", ")}` : undefined;
    },
    () => {
      const unwanted = pairs(need.avoid).filter(([k, v]) => has(attributes, k, v));
      return unwanted.length ? `has ${unwanted.map(([k, v]) => `${k}:${v}`).join(", ")}` : undefined;
    },
    () => {
      const level = location?.priceLevel;
      const { min: lo = 1, max: hi = 4 } = need.priceLevel ?? {};
      return level && (level < lo || level > hi) ? `price level ${level}` : undefined;
    },
    () =>
      party && ((min && party.size < min) || (max && party.size > max))
        ? `${party.size} people, offer is for ${min ?? 1}–${max ?? "any"}`
        : undefined,
    () => (need.when && location && !isOpen(location, need.when) ? "closed at that time" : undefined),
    () =>
      need.when && !isAvailable(offering, need.when, location?.timezone ?? "UTC") ? "offer not available at that time" : undefined,
    () =>
      limit !== undefined && cost > limit * rules.budgetFactor
        ? `over budget (${cost} > ${limit} ${offering.price.currency})`
        : undefined,
  ];
  for (const [i, check] of checks.entries()) {
    const reason = check();
    if (reason) return { failedAt: i, reason };
  }

  const relaxed: Relaxation[] = pairs(rules.dropped)
    .filter(([k, v]) => !has(attributes, k, v))
    .map(([k, v]) => ({ needId: need.id, constraint: `${k}:${v}`, from: "required", to: "dropped" }));
  if (limit !== undefined && cost > limit) {
    relaxed.push({ needId: need.id, constraint: "budget", from: String(limit), to: String(cost) });
  }
  const preferredHits = pairs(need.preferred).filter(([k, v]) => has(attributes, k, v)).length;
  const priceFit = limit ? 0.5 * (1 - cost / limit) : 0;
  return { candidate: { offering, cost, score: preferredHits + priceFit - relaxed.length, relaxed }, location };
}

function matchBrand(intent: Intent, need: Need, record: BrandRecord, rules: Rules): BrandMatch | Exclusion {
  const outcomes = record.offerings.flatMap((offering) => {
    const locations = record.locations.filter((l) => !offering.locationIds || offering.locationIds.includes(l.id));
    return (record.locations.length ? locations : [undefined]).map((l) => evaluate(intent, need, record, offering, l, rules));
  });
  const passed = outcomes.flatMap((o) => ("candidate" in o ? [o] : []));
  if (!passed.length) {
    const furthest = outcomes.flatMap((o) => ("reason" in o ? [o] : [])).sort((a, b) => b.failedAt - a.failedAt)[0];
    return { brandId: record.brand.id, reason: furthest?.reason ?? "no offers" };
  }
  passed.sort((a, b) => b.candidate.score - a.candidate.score);
  const location = passed[0]!.location;
  const offerings = passed.filter((o) => o.location === location).map((o) => o.candidate);
  return { record, location, offerings, score: offerings[0]!.score };
}

function run(intent: Intent, need: Need, brands: BrandRecord[], rules: Rules) {
  const matches: BrandMatch[] = [];
  const excluded: Exclusion[] = [];
  for (const record of brands) {
    const result = matchBrand(intent, need, record, rules);
    if ("reason" in result) excluded.push(result);
    else matches.push(result);
  }
  return { matches: matches.sort((a, b) => b.score - a.score), excluded };
}

// Ranked best first; the caller decides how many to show.
export function matchNeed(intent: Intent, need: Need, brands: BrandRecord[], vocabulary: Vocabulary): NeedMatch {
  const strict = run(intent, need, brands, { required: need.required, dropped: {}, budgetFactor: 1 });
  if (strict.matches.length) return { needId: need.id, ...strict, closest: false };
  return { needId: need.id, ...run(intent, need, brands, closestRules(need, vocabulary)), closest: true };
}
