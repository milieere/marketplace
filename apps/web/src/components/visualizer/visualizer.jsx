import styles from "./visualizer.module.css";
import CardView from "../cardView/cardView";

export default function Visualizer() {
  return (
    <section className={styles.visualizer}>
      <CardView />
    </section>
  );
}
