const fs = require("fs");
const path = require("path");

module.exports = (() => {
  const getForms = async ({ src }) => {
    const dir = src
      ? `../../../../${src}`
      : "../../../../test/Forms/JsonLoadFormsTest.json";

    const contents = fs.readFileSync(path.join(__dirname, dir));
    const Forms = JSON.parse(contents);

    if (Forms.models) {
      const forms = Forms.models.form || Forms.models.Form;
      if (!forms) {
        return [];
      }
      const arrayForms = [];
      Object.keys(forms).forEach(f => {
        arrayForms.push(JSON.parse(forms[f]));
      });
      return arrayForms;
    }

    return Forms;
  };

  const load = async ({ path }) => {
    return getForms({ src: path });
  };
  return Object.freeze({
    load
  });
})();
