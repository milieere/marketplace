import styles from "./hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <section className={styles.heroContent}>
        <h1>Convierte tus ideas en planes reales</h1>
        <h2>Genera anuncios y beneficios en tiempo real</h2>
      </section>
      <form className={styles.heroForm}>
        <label>
          <input type="text" placeholder="Search..." />
          <div className={styles.btnHero}>g</div>
        </label>
        <button>Generar</button>
      </form>
    </section>
  );
}
