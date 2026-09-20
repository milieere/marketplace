import styles from "./header.module.css";
import Image from "next/image";

export default function Header() {
  return (
    <section className={styles.header}>
      <div className={styles.legal}>
        <p>Desarrollado para:</p>
        <h3>@HackBarna26</h3>
      </div>
      <div className={styles.logo}>Oli</div>
      <button className={styles.btnAction}>Mi perfil</button>
    </section>
  );
}
