import KcAdminClient, { requiredAction } from "keycloak-admin";

import UserRepresentation from "keycloak-admin/lib/defs/userRepresentation";
import { RequiredActionAlias } from "keycloak-admin/lib/defs/requiredActionProviderRepresentation";

// Configure
const BASE_URL = process.env.AUTH_SERVER_URL;
const REALM_NAME = "master";

const config = {
  baseUrl: BASE_URL,
  realmName: REALM_NAME
};

export default class Keycloak {
  private kcClient: KcAdminClient;
  private initDone: boolean = false;

  constructor() {
    this.kcClient = new KcAdminClient(config);
  }

  private async init(): Promise<void> {
    this.initDone = true;
    return this.kcClient.auth({
      username: "" + process.env.KEYCLOAK_USER,
      password: "" + process.env.KEYCLOAK_PASSWORD,
      grantType: "password",
      clientId: "admin-cli"
    });
  }

  private async getClientId(clientName: string = "account"): Promise<string> {
    const clients = await this.kcClient.clients.find({ clientId: clientName });
    if (!clients || !clients.length || !clients[0].id) {
      throw new Error("Client not found");
    }
    return clients[0].id;
  }

  private async getClientRoles({
    clientId,
    roleNames
  }: {
    clientId: string;
    roleNames: string[];
  }): Promise<Array<{ id: string; name: string }>> {
    const clientRoles = [];
    for (let i = 0; i < roleNames.length; i += 1) {
      const roleName = roleNames[i];
      const role = await this.kcClient.clients.findRole({
        id: clientId,
        roleName: roleName
      });
      if (!role || !role.id) {
        throw new Error("Role not found");
      }
      clientRoles.push({
        id: role.id,
        name: roleName
      });
    }
    return clientRoles;
  }

  private async addClientRolesToUser({
    userId,
    clientId,
    roles
  }: {
    userId: string;
    clientId: string;
    roles: Array<{ id: string; name: string }>;
  }): Promise<void> {
    return this.kcClient.users.addClientRoleMappings({
      id: userId,
      clientUniqueId: clientId,
      roles
    });
  }

  private async createUser(
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    clientRoles: string[] = []
  ): Promise<UserRepresentation | null> {
    await this.kcClient.users.create({
      realm: REALM_NAME,
      enabled: true,
      username: email,
      email: email,
      firstName: firstName,
      lastName: lastName,
      credentials: [
        {
          type: "password",
          value: password,
          temporary: false
        }
      ],
      emailVerified: false
    });
    const user: UserRepresentation = await this.getUser(email);
    if (!user || !user.id) {
      return null;
    }
    if (clientRoles && clientRoles.length) {
      const clientId = await this.getClientId();

      const clientRolesWithIds = await this.getClientRoles({
        clientId,
        roleNames: clientRoles
      });

      await this.addClientRolesToUser({
        userId: user.id,
        clientId,
        roles: clientRolesWithIds
      });
    }
    return user;
  }

  /**
   * Find user by username (email).
   *
   * Throws if user does not exist.
   */
  async getUser(username: string): Promise<UserRepresentation> {
    if (!this.initDone) {
      await this.init();
    }
    const users: UserRepresentation[] = await this.kcClient.users.find({
      username
    });
    if (users.length < 1) {
      throw new Error("No user found");
    }
    return Promise.resolve(users[0]);
  }

  private async sendActionsEmail(
    userId: string,
    actions: RequiredActionAlias[]
  ): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      try {
        await this.kcClient.users.executeActionsEmail({
          id: userId,
          actions
        });
      } catch (err) {
        console.log("Failed to send email: ", err.message);
      }
    }
    return Promise.resolve();
  }

  /**
   * Create the new user with given password.
   *
   * Return: The newly created users keycloak ID.
   */
  async createNewUser({
    email,
    firstName,
    lastName,
    password,
    clientRoles
  }: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    clientRoles: string[];
  }): Promise<string> {
    if (!this.initDone) {
      await this.init();
    }
    const user: UserRepresentation | null = await this.createUser(
      email,
      firstName,
      lastName,
      password,
      clientRoles
    );

    if (!user || !user.id) {
      throw new Error("User not created properly");
    }

    await this.sendActionsEmail(user.id, [requiredAction.VERIFY_EMAIL]);

    return Promise.resolve(user.id);
  }

  /* ONLY TO BE USED BY SEED SCRIPT OR TESTS */
  async deleteAllUsers() {
    if (!this.initDone) {
      await this.init();
    }

    let kcUsers: UserRepresentation[] = await this.kcClient.users.find();
    //Delete the user by username (email)
    for (let u of kcUsers) {
      if (u.username === "admin") {
        // Don't delete admin or we will never be able to login to keycloak.
        continue;
      }
      await this.kcClient.users.del({
        id: u.id!!
      });
    }

    return Promise.resolve();
  }
}
