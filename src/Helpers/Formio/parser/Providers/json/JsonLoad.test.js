const to = require("await-to-js").default;

// eslint-disable-next-line no-underscore-dangle
const loader = require("../../../loader");

let models;
let error;

beforeAll(async () => {
  [error, models] = await to(loader({ source: "json" }));
});

test("Should get models from local JSON", async () => {
  expect(error).toBe(null);
  expect(Array.isArray(models)).toBe(true);
});

test("Should have the base models", async () => {
  const translations = models.find(m => m.name === "translations");

  expect(typeof translations).toBe("object");
});

test("Should create the proper relations", async () => {
  const countries = models.find(m => m.name === "countries");
  const providers = models.find(m => m.name === "providers");
  const products = models.find(m => m.name === "products");
  expect(typeof countries).toBe("object");
  expect(typeof providers).toBe("object");
  expect(typeof products).toBe("object");
});

/*
test('Should generate Models from Form', async () => {
  usersModel = models.find(f => f.name === 'users');
  expect(usersModel).toHaveProperty('base');
  expect(usersModel).toHaveProperty('forceId');
});
*/
