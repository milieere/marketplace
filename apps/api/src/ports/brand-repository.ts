import type { BrandRecord } from "@marketplace/contracts/brand-record";
import type { Vocabulary } from "@marketplace/contracts/vocabulary";

export interface BrandRepository {
  /** Verified brands that take part in matching (never the house brand). */
  listVerified(): Promise<BrandRecord[]>;
  get(id: string): Promise<BrandRecord | undefined>;
  /** INTENT's own brand kit, used for fallback pages. */
  house(): Promise<BrandRecord>;
  vocabulary(industry: string): Promise<Vocabulary>;
  /** Stores a reviewed record and makes it matchable without a restart. */
  save(record: BrandRecord): Promise<void>;
  /** A brand photo or logo as a data URI, or undefined when the file is missing. */
  asset(url: string): Promise<string | undefined>;
}
