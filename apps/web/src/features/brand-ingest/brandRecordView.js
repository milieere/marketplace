export const LOW_CONFIDENCE = 0.8;

export function indexEvidence(evidence = []) {
  const byField = new Map();
  for (const item of evidence) {
    const existing = byField.get(item.field);
    if (existing) existing.push(item);
    else byField.set(item.field, [item]);
  }
  return byField;
}

// A field renders one value but evidence may address it more precisely, e.g. colors[olive].hex under colors[olive]
export function evidenceFor(index, path) {
  const exact = index.get(path);
  if (exact) return exact;
  const prefix = `${path}.`;
  const matches = [];
  for (const [field, items] of index) if (field.startsWith(prefix)) matches.push(...items);
  return matches;
}

export function lowConfidence(evidence = []) {
  return evidence.filter((item) => item.confidence < LOW_CONFIDENCE);
}

// checkBrandRecord names the offender inline, e.g. `offering cb-x: unknown kind "y"`
export function issuesAbout(issues, ...needles) {
  return issues.filter((issue) => needles.some((needle) => issue.includes(needle)));
}

export function replaceAt(list, index, next) {
  return list.map((item, current) => (current === index ? next : item));
}
