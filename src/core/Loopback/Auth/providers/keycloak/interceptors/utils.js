import { KeycloakUser } from "./types";
import * as Keycloak from "keycloak-connect";
import { AppBindings } from "../helpers/keys";
import { InvocationContext } from "@loopback/core";
import { Request, Response, RestBindings } from "@loopback/rest";
import { KEYCLOAK_STORAGE_COOKIE } from "../helpers/CookieSessionStore";

const cookieSession = require("cookie-session");

const getReqRes = async (
  invocationCtx: InvocationContext
): Promise<{ req: Request; res: Response }> => {
  const req: Request = await invocationCtx.parent.get(
    RestBindings.Http.REQUEST
  );
  const res: Response = await invocationCtx.parent.get(
    RestBindings.Http.RESPONSE
  );
  return Promise.resolve({ req, res });
};

const getKeycloak = async (
  invocationCtx: InvocationContext
): Promise<Keycloak> => {
  return invocationCtx.parent.get(AppBindings.KEYCLOAK);
};

const prepare = async (invocationCtx: InvocationContext) => {
  const { req, res } = await getReqRes(invocationCtx);
  const keycloak = await getKeycloak(invocationCtx);
  await new Promise((resolve, reject) => {
    cookieSession({
      secret: process.env["COOKIE_SECRET"],
      name: KEYCLOAK_STORAGE_COOKIE,
      path: "/",
      httpOnly: true,
      secure: false,
      maxAge: 3600000
    })(req, res, (error: any) => {
      if (error) {
        reject(error);
      }
      resolve();
    });
  });

  const keycloakMiddlewares = keycloak.middleware();
  // @ts-ignore
  for (const keycloakMiddleware of keycloakMiddlewares) {
    await new Promise((resolve, reject) => {
      keycloakMiddleware(req, res, (err: any) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }
};

const extractKeycloakUser = (req: Request): KeycloakUser | null => {
  // kauth is added by checkSso middleware
  // @ts-ignore
  if (req.kauth && req.kauth.grant && req.kauth.grant.access_token) {
    // @ts-ignore
    const tokenContent = req.kauth.grant.access_token.content;
    return {
      id: tokenContent.sub,
      name: tokenContent.name,
      firstName: tokenContent.given_name,
      lastName: tokenContent.family_name,
      email: tokenContent.email,
      roles: tokenContent.resource_access.account.roles
    };
  }
  return null;
};

export { getReqRes, getKeycloak, prepare, extractKeycloakUser };
