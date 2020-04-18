const mongo = require("mongodb").MongoClient;
// const ConnectionString = require("../../../../config/MongoConnectionString");
const _G = require("../../../../dist/__goat__/utilities").default;

module.exports = (() => {
  const connectToDB = MongoConnectionString => {
    return new Promise((resolve, reject) => {
      mongo.connect(
        MongoConnectionString,
        { useNewUrlParser: true, useUnifiedTopology: true },
        (error, client) => {
          if (error) {
            _G.error(error, "Could not connect to MongoDB", {
              tags: ["mongo"]
            });
          }
          resolve(client);
        }
      );
    });
  };

  const getForms = client => {
    return new Promise((resolve, reject) => {
      const db = client.db(process.env.MONGO_DB_NAME);
      db.collection("forms")
        .find({})
        .toArray((error, result) => {
          if (error) {
            _G.error(error, "Could not get Forms from MongoDB", {
              tags: ["mongo"]
            });
            reject();
          }
          client.close();
          resolve(result);
        });
    });
  };

  const load = async () => {
    //const connectionString = await ConnectionString.get();
    //const client = await connectToDB(connectionString);
    //return getForms(client);
  };
  return Object.freeze({
    load
  });
})();
