import styles from "./headerOptions.module.css";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "../../lib/fontawesome";


export default function HeaderOptions() {
  return (
    <section className={styles.header}>
      <div className={styles.legal}>
        <h3>@HackBarna26</h3>
      </div>
      <Image src="/logo.png" alt="Logo" width={100} height={68} />
      <button className={styles.btnAction}>
        Volver al home
        <FontAwesomeIcon icon={faUser} />
      </button>
    </section>
  );
}
