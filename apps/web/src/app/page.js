import Head from "next/head";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./page.module.css";
import Hero from "../components/hero/hero";
import Header from "../components/header/header";
import { faWandMagicSparkles } from "../lib/fontawesome";

export default function Home() {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Oli - Creatividades personalizadas para marcas hospitality</title>
        <meta
          name="description"
          content="Oli transforma una intención de usuario en anuncios y experiencias personalizadas, fieles a la marca y basadas en ofertas reales."
        />
        <meta name="robots" content="index, follow" />
        <meta
          name="keywords"
          content="Oli, hospitality, anuncios personalizados, brand safety, creatividad generativa, restaurantes, hoteles, ofertas verificadas"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.ico" />
        <meta
          property="og:title"
          content="Oli - Creatividades personalizadas para marcas hospitality"
        />
        <meta
          property="og:description"
          content="Cada mensaje de marca, personalizado para lo que una persona acaba de pedir y siempre construido con datos reales de la marca."
        />
        <meta property="og:image" content="/favicon.ico" />
        <meta property="og:url" content="https://oli.intent-demo.com" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://oli.intent-demo.com" />
      </Head>
      <main className={styles.main}>
        <div className={styles.homeIcon} aria-label="Oli generative magic">
          <FontAwesomeIcon icon={faWandMagicSparkles} />
        </div>
        <Header />
        <Hero />
      </main>
    </>
  );
}
