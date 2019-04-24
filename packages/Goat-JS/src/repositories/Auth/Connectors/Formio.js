import md5 from 'md5';
import Promise from 'bluebird';
import AuthInterface from '../AuthInterface';
import Configuration from '../../../models/Configuration';
import User from '../../../models/User';
import Connection from '../../../Wrappers/Connection';
import Utilities from '../../../utilities';
import Role from '../../../models/Role';

export default AuthInterface.compose({
  methods: {
    /**
     *
     *
     * @param {any} credentials
     * @returns
     */
    async localAuthenticate(credentials) {
      const { username, password } = credentials;
      let config = await Configuration.local().first();

      // Hash password
      const hashedPassword = md5(password, config.MD5_KEY);

      // Get the user
      let dbUser = await User.local()
        .where('data.username', '=', username)
        .get();
      let userFound = dbUser && dbUser[0] ? dbUser[0] : undefined;

      if (!userFound) {
        throw new Error();
      }
      // Compare hashed passwords
      const isValidUser = userFound.data.hashedPassword === hashedPassword;

      if (!isValidUser) {
        throw new Error();
      }
      // If is valid, return the user
      return userFound;
    },
    /**
     *
     *
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    async remoteAuthenticate(credentials, role) {
      let response = await User.login({ credentials: credentials, role: role });
      let user = response.data;

      await User.updateUser(user);
      return response;
    },
    /**
     *
     * Authenticates the User with the given credentials
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    async authenticate(credentials, role) {
      let isOnline = await Connection.isOnline();

      if (isOnline) {
        return this.remoteAuthenticate(credentials, role);
      }
      return this.localAuthenticate(credentials);
    },
    /**
     *
     *
     * @param {any} credentials
     * @param {any} role
     * @returns
     */
    attempt(credentials, role) {
      role = role || 'user';

      return new Promise((resolve, reject) => {
        this.authenticate(credentials, role)
          // If credentials are OK
          .then(async (response) => {
            let headers = response.headers || {};
            let user = response.data;
            /* eslint-disable*/

            user.x_jwt_token = headers['x-jwt-token'];
            /* eslint-enable*/

            // Save auth user
            localStorage.setItem('authUser', JSON.stringify(user));
            localStorage.setItem('formioToken', headers['x-jwt-token']);
            // user.isAdmin = true
            let roles = await Role.local().first();

            user.rolesNames = [];
            Object.keys(roles).forEach((key) => {
              if (key !== '$loki' && key !== '_id' && key !== 'meta') {
                if (user.roles && user.roles.indexOf(roles[key]._id) !== -1) {
                  user.rolesNames.push(roles[key]);
                }
              }
            });

            localStorage.setItem('authUser', JSON.stringify(user));

            resolve(user);
          })
          // If there are errors
          .catch((error) => {
            console.log('There was an error over here!');
            reject(error);
          });
      });
    },
    /**
     *
     *
     * @returns
     */
    user() {
      try {
        let user = JSON.parse(localStorage.getItem('authUser'));

        return user === null ? false : user;
      } catch (e) {
        localStorage.removeItem('authUser');
        return false;
      }
    },
    /**
     *
     *
     * @returns
     */
    email() {
      let email = '';

      if (this.user() && this.user().data && this.user().data.email) {
        email = this.user().data.email;
      } else if (this.user() && this.user().email) {
        email = this.user().email;
      }
      return email;
    },
    /**
     *
     *
     * @param {any} roleName
     * @returns
     */
    hasRole(roleName) {
      let user = JSON.parse(localStorage.getItem('authUser'));

      user = user === null ? false : user;

      let result = user.rolesNames.find((r) => {
        return r.title === roleName;
      });

      return typeof result !== 'undefined';
    },
    /**
     *
     *
     * @param {any} roles
     * @returns
     */

    hasRoleIn(roles) {
      if (!roles || Utilities.isEmpty(roles)) {
        return true;
      }
      return roles.some((role) => {
        return this.hasRole(role) || role === 'Authenticated';
      });
    },
    /**
     *
     *
     * @param {any} rolesIds
     * @returns
     */
    async hasRoleIdIn(rolesIds) {
      if (!rolesIds || Utilities.isEmpty(rolesIds)) {
        return true;
      }
      let appRoles = await Role.local().first();

      let roles = rolesIds.reduce((reducer, roleId) => {
        Object.keys(appRoles).forEach(function (role) {
          if (appRoles[role] && appRoles[role]._id && appRoles[role]._id === roleId) {
            reducer.push(appRoles[role].title);
          }
        });
        return reducer;
      }, []);

      return roles.some((role) => {
        return this.hasRole(role) || role === 'Authenticated';
      });
    },
    /**
     * Checks if the current user is
     * Authenticated
     * @return {boolean}
     */
    check() {
      let user = JSON.parse(localStorage.getItem('authUser'));

      return !!user && !!user.x_jwt_token;
    },
    /**
     * Logs out autheticated user
     *
     */
    async logOut() {
      await localStorage.removeItem('authUser');
      await localStorage.removeItem('formioToken');
      await localStorage.removeItem('formioUser');
    }
  }
});
