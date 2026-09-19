import type { Artifact } from "@marketplace/contracts/artifact";
import { describe, expect, it } from "vitest";
import { checkCopy } from "../../src/domain/check";
import { loadRepository } from "../support";

const slots = (over: Partial<Artifact["slots"]> = {}): Artifact["slots"] => ({
  headline: "Friday on the terrace",
  body: "Eight tapas for 8 friends at 21:00.",
  badges: [],
  cta: { label: "Reserve for 8", url: "#" },
  ...over,
});

async function kit() {
  return (await (await loadRepository()).get("casa-brisa"))!.brandKit;
}

describe("checkCopy", () => {
  it("passes clean copy; people counts and times are not prices", async () => {
    expect(checkCopy(await kit(), slots(), [["#2B2118", "#F6EFE6"]])).toEqual([]);
  });

  it("blocks any amount of money in the copy", async () => {
    for (const body of ["Only €28 each", "28€ pp", "just 28 euros", "30 EUR a head"]) {
      expect(checkCopy(await kit(), slots({ body }), []).map((i) => i.ruleId), body).toContain("no-prices-in-copy");
    }
  });

  it("applies the brand's own rules", async () => {
    const ids = checkCopy(await kit(), slots({ headline: "A".repeat(61), body: "Great deal tonight" }), [["#C8553D", "#F6EFE6"]]).map((i) => i.ruleId);
    expect(ids).toEqual(expect.arrayContaining(["headline-length", "no-discount-talk", "text-contrast"]));
  });
});
