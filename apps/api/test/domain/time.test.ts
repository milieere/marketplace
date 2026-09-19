import { describe, expect, it } from "vitest";
import { isAvailable, isOpen } from "../../src/domain/time";
import { loadRepository } from "../support";

async function brand(id: string) {
  const record = await (await loadRepository()).get(id);
  if (!record) throw new Error(`${id} missing`);
  return record;
}

const at = (start: string, end?: string) => ({ start, end });

describe("isOpen", () => {
  it("keeps a Friday range open past midnight into Saturday", async () => {
    const [born] = (await brand("casa-brisa")).locations;
    expect(isOpen(born!, at("2026-09-19T00:30:00+02:00"))).toBe(true);
    expect(isOpen(born!, at("2026-09-19T01:30:00+02:00"))).toBe(false);
  });

  it("carries Sunday night hours into Monday morning", async () => {
    const [terrat] = (await brand("terrat")).locations;
    expect(isOpen(terrat!, at("2026-09-21T01:00:00+02:00"))).toBe(true);
  });

  it("requires the whole visit to fit", async () => {
    const [born] = (await brand("casa-brisa")).locations;
    expect(isOpen(born!, at("2026-09-22T21:00:00+02:00", "2026-09-22T23:30:00+02:00"))).toBe(true);
    expect(isOpen(born!, at("2026-09-22T23:00:00+02:00", "2026-09-23T00:30:00+02:00"))).toBe(false);
  });

  it("checks only arrival and departure for a stay, not the closed night", async () => {
    const [born] = (await brand("casa-brisa")).locations;
    expect(isOpen(born!, at("2026-09-18T20:00:00+02:00", "2026-09-19T14:00:00+02:00"))).toBe(true);
    expect(isOpen(born!, at("2026-09-18T20:00:00+02:00", "2026-09-19T11:00:00+02:00"))).toBe(false);
  });

  it("treats 00:00–23:59 every day as always open, across the week boundary", async () => {
    const [albada] = (await brand("hotel-albada")).locations;
    expect(isOpen(albada!, at("2026-09-20T23:00:00+02:00", "2026-09-21T02:00:00+02:00"))).toBe(true);
  });

  it("reads the time in the location's timezone", async () => {
    const [nami] = (await brand("nami-ramen")).locations;
    expect(isOpen(nami!, at("2026-09-18T19:00:00Z"))).toBe(true);
    expect(isOpen(nami!, at("2026-09-18T15:00:00Z"))).toBe(false);
  });
});

describe("isAvailable", () => {
  it("checks the offer's days and window at the start", async () => {
    const vermut = (await brand("casa-brisa")).offerings.find((o) => o.id === "cb-vermut-hour")!;
    expect(isAvailable(vermut, at("2026-09-23T19:00:00+02:00"), "Europe/Madrid")).toBe(true);
    expect(isAvailable(vermut, at("2026-09-18T19:00:00+02:00"), "Europe/Madrid")).toBe(false);
  });

  it("handles an offer window past midnight", async () => {
    const round = (await brand("terrat")).offerings.find((o) => o.id === "tr-rooftop-round")!;
    expect(isAvailable(round, at("2026-09-19T01:00:00+02:00"), "Europe/Madrid")).toBe(true);
    expect(isAvailable(round, at("2026-09-18T20:00:00+02:00"), "Europe/Madrid")).toBe(false);
  });

  it("stops after validUntil", async () => {
    const round = (await brand("terrat")).offerings.find((o) => o.id === "tr-rooftop-round")!;
    const expired = { ...round, availability: { ...round.availability, validUntil: "2026-09-17" } };
    expect(isAvailable(expired, at("2026-09-18T22:00:00+02:00"), "Europe/Madrid")).toBe(false);
  });
});
