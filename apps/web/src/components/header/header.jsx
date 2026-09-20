import styles from "./header.module.css";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "../../lib/fontawesome";
import Link from "next/link";

export default function Header() {
  return (
    <section className={styles.header}>
      <div className={styles.legal}>
        <p>Desarrollado para:</p>
        <h3>@HackBarna26</h3>
      </div>
      <Link href="/">
        <Image src="/logo.png" alt="Logo" width={73} height={50} />
      </Link>
      <button className={styles.btnAction}>
        Dashboard
        <FontAwesomeIcon icon={faUser} />
      </button>
    </section>
  );
}
