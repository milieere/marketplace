import { describe, expect, it } from "vitest";
import { IntentDraft, normalize } from "../../../src/agents/creative/understand";
import { loadRepository } from "../../support";

async function run(draft: unknown) {
  const vocabulary = await (await loadRepository()).vocabulary("hospitality");
  const now = new Date("2026-09-18T17:00:00+02:00");
  return normalize(IntentDraft.parse(draft), { text: "q", now, timezone: "Europe/Madrid", vocabulary });
}

describe("normalize", () => {
  it("drops values outside the vocabulary instead of matching on them", async () => {
    const intent = await run({
      scope: "in-domain",
      language: "en",
      party: { size: 2 },
      needs: [{ label: "x", when: { start: "2026-09-18T21:00:00+02:00" }, kinds: ["menu", "spaceship"], required: { dietary: ["vegan", "keto"], mood: ["fun"] } }],
    });
    expect(intent.needs[0]!.required).toEqual({ dietary: ["vegan"] });
    expect(intent.needs[0]!.kinds).toEqual(["menu"]);
    expect(intent.dropped).toEqual(expect.arrayContaining(["required.dietary:keto", "required.mood", "kinds:spaceship"]));
  });

  it("moves soft attributes out of required", async () => {
    const intent = await run({ scope: "in-domain", language: "en", party: { size: 2 }, needs: [{ label: "x", required: { ambience: ["quiet"] } }] });
    expect(intent.needs[0]!.required).toEqual({});
    expect(intent.needs[0]!.preferred).toEqual({ ambience: ["quiet"] });
  });

  it("fills tonight and a party of two, and says so", async () => {
    const intent = await run({ scope: "unclear", language: "en", needs: [] });
    expect(intent.needs[0]!.when?.start).toBe("2026-09-18T21:00:00+02:00");
    expect(intent.party?.size).toBe(2);
    expect(intent.assumed).toEqual(["needs[n1].when: Fri 21:00", "party.size: 2"]);
  });

  it("replaces an unparseable time with the default", async () => {
    const intent = await run({ scope: "in-domain", language: "en", party: { size: 2 }, needs: [{ label: "x", when: { start: "friday night" } }] });
    expect(intent.dropped).toContain("when:friday night");
    expect(intent.needs[0]!.when?.start).toBe("2026-09-18T21:00:00+02:00");
  });

  it("keeps no needs for out-of-domain requests", async () => {
    expect((await run({ scope: "out-of-domain", language: "en", needs: [] })).needs).toEqual([]);
  });
});
