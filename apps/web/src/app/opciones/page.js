import styles from "./page.module.css";
import Head from "next/head";
import { Suspense } from "react";
import Header from "../../components/header/header";
import Visualizer from "../../components/visualizer/visualizer";


export default function Opciones() {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Oli - Opciones generadas para tu intención</title>
        <meta
          name="description"
          content="Explora cómo Oli interpreta una intención, encuentra marcas compatibles y genera creatividades listas para reservar."
        />
        <meta name="robots" content="index, follow" />
        <meta
          name="keywords"
          content="Oli, resultados personalizados, intent matching, anuncios hospitality, brand kit, ofertas reales"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.ico" />
        <meta property="og:title" content="Oli - Opciones generadas para tu intención" />
        <meta
          property="og:description"
          content="Visualiza el stream del agente creativo: intención, matches, revisiones y artifacts personalizados por marca."
        />
        <meta property="og:image" content="/favicon.ico" />
        <meta property="og:url" content="https://oli.intent-demo.com/opciones" />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://oli.intent-demo.com/opciones" />
      </Head>
      <main className={styles.main}>
        <Header />
        <Suspense fallback={null}>
          <Visualizer />
        </Suspense>
      </main>
    </>
  );
}
