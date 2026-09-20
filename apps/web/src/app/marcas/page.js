import BrandOnboarding from "../../components/brandOnboarding/brandOnboarding";
import Header from "../../components/header/header";
import styles from "./page.module.css";

export const metadata = {
  title: "Oli - Alta de marcas",
  description:
    "Sube la guía de marca, las ofertas y las fotos de una marca hospitality. El agente extrae el brand kit con la evidencia de cada dato y tú lo apruebas.",
  alternates: { canonical: "https://oli.intent-demo.com/marcas" },
  openGraph: {
    title: "Oli - Alta de marcas",
    description: "Del PDF de marca a un brand kit verificado, con la página y la cita de cada dato extraído.",
    url: "https://oli.intent-demo.com/marcas",
    type: "website",
  },
};

export default function Marcas() {
  return (
    <main className={styles.main}>
      <Header />
      <BrandOnboarding />
    </main>
  );
}
