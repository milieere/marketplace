import { describe, expect, it } from "vitest";
import { grounded, mapTerms, mergeColors, parseCsv, parseDays, parseOpeningHours } from "../../../src/agents/brand/normalize";
import { loadRepository } from "../../support";

const vocabulary = await (await loadRepository()).vocabulary("hospitality");

describe("mergeColors", () => {
  it("prefers tokens, converts CMYK-only colours in code and computes contrast-safe pairs", () => {
    const { colors, converted, notes } = mergeColors(
      [{ id: "terracotta", hex: "#C8553D", role: "primary" }, { id: "sand", hex: "#F6EFE6", role: "background" }, { id: "ink", hex: "#2B2118", role: "text" }],
      [
        { id: "terracotta", name: "Terracotta", role: "primary", hex: "#C8553D" },
        { id: "olive", name: "Olive", role: "secondary", cmyk: [15, 0, 46, 58] },
        { id: "saffron", name: "Saffron", role: "accent", hex: "#F2A541" },
      ],
    );
    expect(Object.fromEntries(colors.map((c) => [c.id, c.hex]))).toEqual({
      terracotta: "#C8553D",
      sand: "#F6EFE6",
      ink: "#2B2118",
      olive: "#5B6B3A",
      saffron: "#F2A541",
    });
    expect(converted).toEqual([{ id: "olive", hex: "#5B6B3A", cmyk: [15, 0, 46, 58] }]);
    expect(notes).toEqual(["Colour 'Olive' was only given in CMYK (15 0 46 58); converted to #5B6B3A. Please confirm."]);
    const pairs = Object.fromEntries(colors.map((c) => [c.id, c.pairsWith]));
    expect(pairs.olive).toEqual(["sand"]);
    expect(pairs.saffron).toEqual(["ink"]);
    expect(pairs.sand).toEqual(expect.arrayContaining(["terracotta", "ink", "olive"]));
  });

  it("flags tokens and guidelines that disagree, and keeps the tokens", () => {
    const { colors, notes } = mergeColors([{ id: "ink", hex: "#2B2118", role: "text" }], [{ id: "ink", name: "Ink", role: "text", hex: "#000000" }]);
    expect(colors[0]!.hex).toBe("#2B2118");
    expect(notes[0]).toMatch(/design tokens say #2B2118, the guidelines say #000000/);
  });
});

describe("mapTerms", () => {
  it("maps exact values, plurals and synonyms onto the vocabulary and reports leftovers", () => {
    expect(mapTerms(["groups", "Celebrations", "date night", "after-work", "karaoke"], "offering", vocabulary, "occasion")).toEqual({
      attributes: { occasion: ["group", "celebration", "date-night", "work"] },
      leftovers: ["karaoke"],
    });
    expect(mapTerms(["V", "VG", "GF"], "offering", vocabulary, "dietary").attributes).toEqual({ dietary: ["vegetarian", "vegan", "gluten-free"] });
  });
});

describe("parseOpeningHours", () => {
  it("reads printed lines, day ranges and past-midnight closing", () => {
    const { hours, unparsed } = parseOpeningHours(["Monday closed", "Tuesday–Thursday 18:00–00:00", "Friday–Saturday 13:00–01:00", "Sun 13:00-17:00", "ask us"]);
    expect(hours).toEqual({
      tue: [{ from: "18:00", to: "00:00" }],
      wed: [{ from: "18:00", to: "00:00" }],
      thu: [{ from: "18:00", to: "00:00" }],
      fri: [{ from: "13:00", to: "01:00" }],
      sat: [{ from: "13:00", to: "01:00" }],
      sun: [{ from: "13:00", to: "17:00" }],
    });
    expect(unparsed).toEqual(["ask us"]);
  });

  it("parses day lists and wrap-around ranges", () => {
    expect(parseDays("tue-sat")).toEqual(["tue", "wed", "thu", "fri", "sat"]);
    expect(parseDays("sat-mon")).toEqual(["sat", "sun", "mon"]);
    expect(parseDays("someday")).toBeUndefined();
  });
});

describe("parseCsv", () => {
  it("handles quoted commas and doubled quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([{ a: "x, y", b: 'say "hi"' }]);
  });
});

describe("grounded", () => {
  it("ignores PDF line breaks and dash variants", () => {
    expect(grounded("Reservations https://casabrisa.example/reserve?\nvenue=born", "https://casabrisa.example/reserve?venue=born")).toBe(true);
    expect(grounded("Tuesday–Thursday 18:00–00:00", "Tuesday-Thursday 18:00-00:00")).toBe(true);
    expect(grounded("HEX #C8553D", "#D2691E")).toBe(false);
  });
});
