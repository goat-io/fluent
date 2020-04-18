import { Interceptor } from '@loopback/core';
import { getReqRes, getKeycloak, prepare, extractKeycloakUser } from './utils';
import { AppBindings } from '../helpers/keys';

const check = (): Interceptor => async (invocationCtx, next) => {
  const { req, res } = await getReqRes(invocationCtx);
  const keycloak = await getKeycloak(invocationCtx);
  await prepare(invocationCtx);
  return new Promise((resolve, reject) => {
    // @ts-ignore
    keycloak.checkSso()(req, res, (err: any) => {
      if (err) {
        reject(err);
      }
      const user = extractKeycloakUser(req)!;
      invocationCtx.bind(AppBindings.KEYCLOAK_USER).to(user);
      resolve(next());
    });
  });
};

export { check };
