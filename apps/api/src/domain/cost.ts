import type { Offering } from "@marketplace/contracts/brand-record";
import type { Need } from "@marketplace/contracts/intent";

type Budget = NonNullable<Need["budget"]>;
type When = NonNullable<Need["when"]>;

function hours(when?: When): number | undefined {
  return when?.end ? (Date.parse(when.end) - Date.parse(when.start)) / 3_600_000 : undefined;
}

// `from` prices count at their minimum.
export function totalCost(offering: Offering, people: number, when?: When): number {
  const { amount, unit } = offering.price;
  switch (unit) {
    case "person":
      return amount * people;
    case "group":
    case "item":
      return amount;
    case "night":
      return amount * Math.max(1, Math.round((hours(when) ?? 24) / 24));
    case "hour":
      return amount * Math.max(1, Math.ceil(hours(when) ?? 1));
  }
}

export function budgetLimit(budget: Budget, people: number): number {
  return budget.per === "total" ? budget.amount : budget.amount * people;
}
