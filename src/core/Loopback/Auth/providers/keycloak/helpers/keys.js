import { BindingKey } from "@loopback/core";
import * as Keycloak from "keycloak-connect";
import { KeycloakUser } from "../interceptors/types";

export namespace AppBindings {
  export const NEXT_SERVER = BindingKey.create("app.next.server");
  export const KEYCLOAK = BindingKey.create<Keycloak>("app.keycloak");
  export const KEYCLOAK_USER = BindingKey.create<KeycloakUser | null>(
    "app.keycloak.user"
  );
}
