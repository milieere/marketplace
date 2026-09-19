import styles from "./header.module.css";
import Image from "next/image";

export default function Header() {
  return (
    <section className={styles.header}>
      <div className={styles.logo}></div>
      <button>menu</button>
    </section>
  );
}
