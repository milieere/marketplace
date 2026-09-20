"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./hero.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faAngleDown,
  faHexagonNodes,
} from "../../lib/fontawesome";
import Image from "next/image";
import Link from "next/link";

const DEMO_QUERIES = [
  "Friday, 8 friends, two vegans, one celiac, terrace, ~€30 each",
  "Romantic weekend for two, hotel and a nice dinner, €400",
  "Ramen for two tonight, on a terrace",
  "Vegan dinner for 25 people under €10 each",
];

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const canGenerate = Boolean(query.trim());

  function generate(text) {
    const cleanText = text.trim();
    if (!cleanText) return;
    router.push(`/opciones?query=${encodeURIComponent(cleanText)}`);
  }

  function handleSubmit(event) {
    event.preventDefault();
    generate(query);
  }

  return (
    <section className={styles.hero}>
      <section className={styles.heroContent}>
        <h1>
          Una intención, <span>muchas posibilidades</span>
        </h1>
        <h2>Cuéntame qué tienes en mente y descubre diferentes maneras de hacerlo realidad, adaptadas a tu tiempo, presupuesto y momento.</h2>
      </section>
      <form className={styles.heroForm} onSubmit={handleSubmit}>
        <label>
          <input
            type="text"
            value={query}
            placeholder="Ej. Una cena romántica en Barcelona por menos de 50€..."
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className={styles.btnHero}
            disabled={!canGenerate}
            aria-label="Generar"
          >
            <FontAwesomeIcon className={styles.icon} icon={faArrowRight} />
          </button>
        </label>
        <button
          className={styles.btnGenerator}
          type="submit"
          disabled={!canGenerate}
        >
          Generar
          <FontAwesomeIcon className={styles.icon} icon={faHexagonNodes} />
        </button>
      </form>
      <section className={styles.boxFlex}>
        <div className={styles.titleSugerencies}>
          <p>Generaciones más frecuentes</p>
          <FontAwesomeIcon className={styles.icon} icon={faAngleDown} />
        </div>
        <div className={styles.demoQueries} aria-label="Consultas de prueba">
          {DEMO_QUERIES.map((demoQuery) => (
            <button
              key={demoQuery}
              type="button"
              onClick={() => generate(demoQuery)}
            >
              {demoQuery}
            </button>
          ))}
        </div>
      </section>
      <Link className={styles.brandCta} href="/marcas">
        <strong>¿Eres una marca?</strong>
        <span>Sube tu definición de marca, ofertas y fotos: el agente extrae tu brand kit y lo pones a generar.</span>
      </Link>
      <Image src="/bg.png" alt="Hero" fill={true} className={styles.bgImage} />
    </section>
  );
}
