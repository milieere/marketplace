import type { Location, Offering, Weekday } from "@marketplace/contracts/brand-record";
import type { Need } from "@marketplace/contracts/intent";

type When = NonNullable<Need["when"]>;
type Interval = [number, number];

const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY = 24 * 60;
const WEEK = 7 * DAY;
// Longer visits are stays or rentals: the place may close in between.
const STAY = 12 * 60;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

export function localTime(iso: string, timezone: string): { weekMinute: number; date: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  const day = DAYS.indexOf(parts.weekday!.toLowerCase() as Weekday);
  return {
    weekMinute: day * DAY + Number(parts.hour) * 60 + Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function durationMinutes(when: When): number {
  return when.end ? Math.max(0, (Date.parse(when.end) - Date.parse(when.start)) / 60_000) : 0;
}

// `to` <= `from` = past midnight; no `to` = end of day
function interval(day: number, from = "00:00", to?: string): Interval {
  const start = day * DAY + minutes(from);
  const end = to === undefined ? (day + 1) * DAY : day * DAY + minutes(to) + (minutes(to) <= minutes(from) ? DAY : 0);
  return [start, end];
}

// Second week: Sunday ranges spill into Monday.
// 1-minute join: "00:00"–"23:59" daily means always open.
function weekly(intervals: Interval[]): Interval[] {
  const sorted = [...intervals, ...intervals.map(([a, b]): Interval => [a + WEEK, b + WEEK])].sort((x, y) => x[0] - y[0]);
  const merged: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = merged.at(-1);
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

function covers(intervals: Interval[], start: number, end: number): boolean {
  const week = weekly(intervals);
  return [0, WEEK].some((shift) => week.some(([a, b]) => start + shift >= a && start + shift < b && end + shift <= b));
}

export function isOpen(location: Location, when: When): boolean {
  const intervals = DAYS.flatMap((d, i) => (location.openingHours[d] ?? []).map((r) => interval(i, r.from, r.to)));
  const start = localTime(when.start, location.timezone).weekMinute;
  const duration = durationMinutes(when);
  if (duration < STAY) return covers(intervals, start, start + duration);
  const end = localTime(when.end!, location.timezone).weekMinute;
  return covers(intervals, start, start) && covers(intervals, end, end);
}

// Start only: offer windows are when you order, not stay.
export function isAvailable(offering: Offering, when: When, timezone: string): boolean {
  const { days, from, to, validUntil } = offering.availability ?? {};
  const { weekMinute, date } = localTime(when.start, timezone);
  if (validUntil && date > validUntil) return false;
  const intervals = DAYS.flatMap((d, i) => (!days || days.includes(d) ? [interval(i, from, to)] : []));
  return covers(intervals, weekMinute, weekMinute);
}

function offset(date: Date, timezone: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")!.value;
  return name === "GMT" ? "+00:00" : name.slice(3);
}

function hhmm(weekMinute: number): string {
  const m = weekMinute % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Default when the user gives no time: tonight, or right now if already late.
export function tonight(now: Date, timezone: string, at = "21:00"): string {
  const { weekMinute, date } = localTime(now.toISOString(), timezone);
  const time = weekMinute % DAY >= minutes(at) ? hhmm(weekMinute) : at;
  return `${date}T${time}:00${offset(now, timezone)}`;
}

export function describeLocal(iso: string, timezone: string): string {
  const { weekMinute } = localTime(iso, timezone);
  const day = DAYS[Math.floor(weekMinute / DAY)]!;
  return `${day[0]!.toUpperCase()}${day.slice(1)} ${hhmm(weekMinute)}`;
}
