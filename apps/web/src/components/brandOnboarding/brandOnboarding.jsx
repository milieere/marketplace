"use client";

import { useBrandIngest } from "../../features/brand-ingest/useBrandIngest";
import styles from "./brandOnboarding.module.css";
import BrandDropZone from "./parts/BrandDropZone";
import BrandReview from "./parts/BrandReview";
import BrandTimeline from "./parts/BrandTimeline";

export default function BrandOnboarding() {
  const { state, start, cancel, reset } = useBrandIngest();

  function screen() {
    if (state.record) return <BrandReview key={state.record.brand.id} record={state.record} onRestart={reset} />;
    if (state.status === "idle") return <BrandDropZone onStart={start} />;
    return <BrandTimeline state={state} onCancel={cancel} onRestart={reset} />;
  }

  return <section className={styles.onboarding}>{screen()}</section>;
}
