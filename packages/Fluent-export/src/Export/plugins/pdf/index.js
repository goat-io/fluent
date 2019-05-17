import Html2Pdf from "html2pdf.js";
import GoatExportUtils from "../../utils";

const worker = Html2Pdf();

export default (config = { pagebreak: { avoid: ["div"] } }) => {
  config = GoatExportUtils.verifyProperties(config, {
    pagebreak: {
      type: Element,
      required: true
    }
  });
  return worker.set(config);
};
