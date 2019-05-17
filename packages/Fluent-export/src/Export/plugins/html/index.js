import GoatExportUtils from "../../utils";
import { style } from "./style";

export default component => {
  return new Promise((resolve, reject) => {
    try {
      let container = GoatExportUtils.createElement(
        "div",
        { id: "formio__export" },
        style
      );

      component.toHtml(container);
      resolve(container);
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
};
