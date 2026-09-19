import styles from "./cardView.module.css";
import Image from "next/image";

export default function CardView() {
    return(
        <section className={styles.cardView}>
            <section className={styles.card}>
                Card View
            </section>
        </section>
    )
}