"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./hero.module.css";

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    router.push(`/opciones?query=${encodeURIComponent(text)}`);
  }

  return (
    <section className={styles.hero}>
      <section className={styles.heroContent}>
        <h1>Convierte tus ideas en planes reales</h1>
        <h2>Genera anuncios y beneficios en tiempo real</h2>
      </section>
      <form className={styles.heroForm} onSubmit={handleSubmit}>
        <label>
          <input
            type="text"
            value={query}
            placeholder="Ej. Una cena romántica en Barcelona por menos de 50€..."
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={styles.btnHero}>g</div>
        </label>
        <button type="submit" disabled={!query.trim()}>
          Generar
        </button>
      </form>
    </section>
  );
}
