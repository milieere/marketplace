import { config, library } from "@fortawesome/fontawesome-svg-core";
import {
  faAngleDown,
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

library.add(faMicrophone, faAngleDown, faHexagonNodes, faUser, faBullseye, faLayerGroup, faRankingStar, faPenNib, faCheck, faTriangleExclamation);

export { faMicrophone, faAngleDown, faHexagonNodes, faUser, faBullseye, faLayerGroup, faRankingStar, faPenNib, faCheck, faTriangleExclamation };
