const loader = require("./index");
const to = require("await-to-js").default;
const fs = require("fs");
const path = require("path");
var Handlebars = require("handlebars");
const generateTypes = require("./generators/type");
const generateModels = require("./generators/model");




const loadedModules = Models => {
  var templatesDir = __dirname + "/generators/templates";
  const source = fs.readFileSync(templatesDir + "/modules/modules.hbs", "utf8");

  var template = Handlebars.compile(source);
  var result = template(Models);
  const filePath = path.join(__dirname, `../../src/app_modules.ts`);

  fs.writeFileSync(filePath, result);
};

const generate = async () => {
  const [error, Models] = await to(
    loader({
      source: "json",
      path: "src/__goat__/form/storage/forms.json"
    })
  );

  if (error) {
    console.log(error);
    throw new Error("COULD NOT LOAD FORMS...");
  }

  for (Model of Models) {
    generateTypes(Model);
    generateModels(Model);
    generateRepositories(Model);
    generateControllers(Model);
  }

  loadedModules(Models);
};

generate()
  .then(models => {
    console.log("Models where generated successfuly");
  })
  .catch(e => {
    console.log(e);
  });
