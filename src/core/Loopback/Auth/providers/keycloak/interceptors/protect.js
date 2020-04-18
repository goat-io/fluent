import { Interceptor } from '@loopback/core';
import { getReqRes, getKeycloak, prepare, extractKeycloakUser } from './utils';
import { AppBindings } from '../helpers/keys';

const protect = (role?: string): Interceptor => async (invocationCtx, next) => {
  await prepare(invocationCtx);
  const { req, res } = await getReqRes(invocationCtx);
  const keycloak = await getKeycloak(invocationCtx);
  return new Promise((resolve, reject) => {
    keycloak.protect(role)(req, res, (err: any) => {
      if (err) {
        reject(err);
      }
      const user = extractKeycloakUser(req);
      invocationCtx.bind(AppBindings.KEYCLOAK_USER).to(user);
      resolve(next());
    });
  });
};

export { protect };
