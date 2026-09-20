import { config, library } from "@fortawesome/fontawesome-svg-core";
import {
  faAngleDown,
  faArrowRight,
  faBullseye,
  faCheck,
  faHexagonNodes,
  faLayerGroup,
  faMicrophone,
  faPenNib,
  faRankingStar,
  faTriangleExclamation,
  faUser,
} from "@fortawesome/free-solid-svg-icons";

config.autoAddCss = false;

library.add(faArrowRight, faMicrophone, faAngleDown, faHexagonNodes, faUser, faBullseye, faLayerGroup, faRankingStar, faPenNib, faCheck, faTriangleExclamation);

export { faArrowRight, faMicrophone, faAngleDown, faHexagonNodes, faUser, faBullseye, faLayerGroup, faRankingStar, faPenNib, faCheck, faTriangleExclamation };
