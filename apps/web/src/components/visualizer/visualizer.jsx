"use client";

import { useSearchParams } from "next/navigation";
import { useGenerateStream } from "../../features/generate-stream/useGenerateStream";
import VisualizerResults from "./parts/VisualizerResults";
import VisualizerSidebar from "./parts/VisualizerSidebar";
import styles from "./visualizer.module.css";

export default function Visualizer() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query") || "";
  const { state, latestStep } = useGenerateStream(query);

  return (
    <section className={styles.visualizer}>
      {/* <VisualizerSidebar query={query} state={state} latestStep={latestStep} /> */}
      <VisualizerResults query={query} state={state} />
    </section>
  );
}
