import * as Keycloak from "keycloak-connect";
import { Request, Response, RequestHandler } from "express";
const cookieSession = require("cookie-session");
import * as zlib from "zlib";

const KEYCLOAK_STORAGE_COOKIE = "keycloak_grant";

class CookieSessionStore {
  static middleware: Array<RequestHandler> = [
    cookieSession({
      secret: process.env["COOKIE_SECRET"],
      name: KEYCLOAK_STORAGE_COOKIE,
      path: "/",
      httpOnly: true,
      secure: false,
      maxAge: 3600000
    })
  ];
  // @ts-ignore
  get(request: Request) {
    if (!request.session) {
      throw Error("A session is required to get grant.");
    }

    const defaltedGrant = request.session[KEYCLOAK_STORAGE_COOKIE];

    if (!defaltedGrant) {
      return undefined;
    }

    return zlib.inflateSync(Buffer.from(defaltedGrant, "base64")).toString();
  }
  // @ts-ignore
  static store(grant: Keycloak.Grant) {
    return (request: Request, _: Response) => {
      if (!request.session) {
        throw Error("A session is required to store grant.");
      }
      const defaltedGrant = zlib.deflateSync(grant.__raw).toString("base64");
      request.session[KEYCLOAK_STORAGE_COOKIE] = defaltedGrant;
    };
  }

  static unstore(_: Request, response: Response) {
    response.clearCookie(KEYCLOAK_STORAGE_COOKIE);
  }
  // @ts-ignore
  wrap(grant: Keycloak.Grant) {
    if (grant) {
      grant.store = CookieSessionStore.store(grant);
      // For some reason the Grant type does not list unstore as a property.
      // @ts-ignore
      grant.unstore = CookieSessionStore.unstore;
    }
  }
}

export { CookieSessionStore, KEYCLOAK_STORAGE_COOKIE };
