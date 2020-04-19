const {
  FORMIO_HOST,
  FORMIO_PORT,
  FORMIO_PROTOCOL,
  FORMIO_BASE_PATH,
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_SECRET,
  KEYCLOAK_URL,
  KEYCLOAK_REALM
} = process.env;
const got = require("got");
const querystring = require("querystring");
const to = require("await-to-js").default;
const _G = require("../../../../dist/__goat__/utilities").default;

module.exports = (() => {
  const getToken = async () => {
    const url = `${KEYCLOAK_URL}/auth/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const credentials = Buffer.from(`${KEYCLOAK_CLIENT_ID}:${KEYCLOAK_SECRET}`);
    const [error, response] = await to(
      got.post(url, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials.toString("base64")}`
        },
        body: querystring.stringify({
          grant_type: "client_credentials"
        })
      })
    );
    if (error) {
      throw _G.error(error, "Could not get new Token");
    }
    return JSON.parse(response.body);
  };

  const httpRequest = async (path, token) => {
    const url = `${FORMIO_PROTOCOL}://${FORMIO_HOST}:${FORMIO_PORT}${FORMIO_BASE_PATH}${path}`;
    const options = { timeout: 2000 };

    options.headers = token
      ? {
          Authorization: `Bearer ${token.access_token}`
        }
      : undefined;

    const [error, response] = await to(got(url, options));

    if (error) {
      // TODO replace errors
      throw _G.error(error, "Could not connect to the Formio API", {
        tags: ["got", "http", "get"]
      });
    }

    return JSON.parse(response.body);
  };

  const getForms = async () => {
    const hasKeyCloak =
      String(process.env.KEYCLOAK_ENABLED).toLowerCase() === String("true");
    const token = hasKeyCloak ? await getToken() : undefined;
    return httpRequest("/form?limit=99999", token);
  };

  const load = async () => {
    return getForms();
  };
  return Object.freeze({
    load
  });
})();
