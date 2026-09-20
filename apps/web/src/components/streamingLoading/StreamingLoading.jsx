import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import {
  faBullseye,
  faCheck,
  faLayerGroup,
  faPenNib,
  faRankingStar,
  faTriangleExclamation,
} from "../../lib/fontawesome";
import styles from "./streamingLoading.module.css";

function stepStatus(steps, id) {
  return steps?.findLast((step) => step.id === id)?.status;
}

export default function StreamingLoading({ title, state }) {
  const phases = [
    {
      id: "understand",
      label: "Necesidad",
      icon: faBullseye,
      status: stepStatus(state.steps, "understand"),
    },
    {
      id: "filter",
      label: "Datos",
      icon: faLayerGroup,
      status: stepStatus(state.steps, "filter"),
    },
    {
      id: "rank",
      label: "Ranking",
      icon: faRankingStar,
      status: stepStatus(state.steps, "rank"),
    },
    {
      id: "create",
      label: "Anuncios",
      icon: faPenNib,
      status: state.steps.findLast((step) => step.id?.startsWith("create-"))
        ?.status,
    },
  ];

  return (
    <article className={styles.loading}>
      <div className={styles.panel}>
        <div className={styles.texture} aria-hidden="true" />
        <div className={styles.brandIcon}>
          <Image
            src="/icon-brand.png"
            alt="icono-oli"
            width={180}
            height={180}
            priority
          />
        </div>
        <div className={styles.copy}>
          <h2>{title}</h2>
          <p>Ya casi está listo...</p>
        </div>
        <ul className={styles.pipeline} aria-label="Estado de generacion">
          {phases.map((phase, index) => {
            const status =
              phase.status || (index === 0 ? "started" : "waiting");
            const icon =
              status === "done"
                ? faCheck
                : status === "failed"
                  ? faTriangleExclamation
                  : phase.icon;
            return (
              <li key={phase.id} data-status={status}>
                <span>
                  <FontAwesomeIcon icon={icon} />
                </span>
                <strong>{phase.label}</strong>
              </li>
            );
          })}
        </ul>
        <div className={styles.scan} />
      </div>
    </article>
  );
}
