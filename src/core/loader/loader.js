/*

const loader = require("../.goat/loader");
const mongoose = require("mongoose");
const MongoConnectionString = require("../config/MongoConnectionString");
const mongodb = require("mongodb");


const createForms = async () => {
  const Models = require("./models/lb3").default;
  const Form = Models.Form;
  const currentForms = await Form.find();
  let jsonFormFile = require("../.goat/offline/Forms.json");
  // const mongoCollection = Form.getDataSource().connector.collection("form");
  if (Array.isArray(currentForms) && currentForms.length === 0) {
    const [error, inserted] = await Form.create(jsonFormFile);
    if (error) {
      console.log("errror", error);
    }
  }
};

const createRoles = async () => {
  const Models = require("./models/lb3").default;
  const Role = Models.Role;
  const currentRoles = await Role.find();
  let jsonFormFile = require("../.goat/offline/Roles.json");
  const date = new Date().toISOString();

  jsonFormFile = Object.keys(jsonFormFile)
    .map((roleName: any) => {
      if (roleName !== "fastUpdated") {
        const f = jsonFormFile[roleName];
        f.machineName = f.title.toLowerCase();
        f.created = date;
        f.modified = date;
        f.roles = [];
        f.deleted = null;
        return f;
      }
    })
    .filter(Boolean);

  if (Array.isArray(currentRoles) && currentRoles.length === 0) {
    const [error, inserted] = await to(Role.create(jsonFormFile));
    if (error) {
      console.log("errror", error);
    }
    console.log("inserted", inserted.ops);
  }
};

const createPages = async () => {
  const Models = require("./models/lb3").default;
  const Pages = Models["fast-app-pages"];
  const currentPages = await Pages.find();
  let jsonFormFile = require("../.goat/offline/Pages.json");
  const mongoCollection = Pages.getDataSource().connector.collection(
    "fast-app-pages"
  );

  jsonFormFile = jsonFormFile
    .map((f: any) => {
      f._id = new mongodb.ObjectID(f._id);
      return f;
    })
    .filter(Boolean);

  if (Array.isArray(currentPages) && currentPages.length === 0) {
    const [error] = await to(mongoCollection.insertMany(jsonFormFile));
    if (error) {
      console.log("errror", error);
    }
  }
};

const createTranslations = async () => {
  const Models = require("./models/lb3").default;
  const Translations = Models.Translations;
  const currentTranslations = await Translations.find();
  let jsonFormFile = require("../.goat/offline/Translations.json");

  jsonFormFile = jsonFormFile
    .map((f: any) => {
      if (f && f.data) {
        f.data._id = f._id;
        return f.data;
      }
    })
    .filter(Boolean);

  if (Array.isArray(currentTranslations) && currentTranslations.length === 0) {
    const [error] = await to(Translations.create(jsonFormFile));
    if (error) {
      console.log("errror", error);
    }
  }
};


/*

/*
  const connectionString = MongoConnectionString.get();
  await mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  });
  
  const [error] = await to(
    loader({
      source: "json",
      path: "src/storage/forms.json"
    })
  );

  if (error) {
    console.log(error);
    throw new Error("COULD NOT LOAD FORMS...");
  }
*/

  // await createForms();
  // await createRoles();
  // await createPages();
  // await createTranslations();


