import Configuration from '../../models/Configuration';
import md5 from 'md5';
import User from 'models/User';
import Connection from 'Wrappers/Connection';
import Role from 'models/Role';
import Promise from 'bluebird';
import Utilities from 'utilities';

let Auth = (() => {
  /**
   *
   *
   * @param {any} credentials
   * @returns
   */
  const localAuthenticate = async function (credentials) {
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
  };
  /**
   *
   *
   * @param {any} credentials
   * @param {any} baseUrl
   * @param {any} role
   * @returns
   */
  const remoteAuthenticate = async (credentials, baseUrl, role) => {
    let response = await User.login({ credentials: credentials, role: role });
    let user = response.data;

    await User.updateUser(user);
    return response;
  };

  /**
   *
   * Authenticates the User with the given credentials
   * @param {any} credentials
   * @param {any} baseUrl
   * @param {any} role
   * @returns
   */
  const authenticate = async function (credentials, baseUrl, role) {
    let isOnline = await Connection.isOnline();

    if (isOnline) {
      return remoteAuthenticate(credentials, baseUrl, role);
    }
    return localAuthenticate(credentials, baseUrl);
  };
  /**
   *
   *
   * @param {any} credentials
   * @param {any} baseUrl
   * @param {any} role
   * @returns
   */

  const attempt = function (credentials, baseUrl, role) {
    role = role || 'user';

    return new Promise((resolve, reject) => {
      authenticate(credentials, baseUrl, role)
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
  };
  /**
   *
   *
   * @returns
   */

  const user = function () {
    try {
      let user = JSON.parse(localStorage.getItem('authUser'));

      return user === null ? false : user;
    } catch (e) {
      localStorage.removeItem('authUser');
      return false;
    }
  };
  /**
   *
   *
   * @returns
   */

  const email = function () {
    let email = '';

    if (Auth.user() && Auth.user().data && Auth.user().data.email) {
      email = Auth.user().data.email;
    } else if (Auth.user() && Auth.user().email) {
      email = Auth.user().email;
    }
    return email;
  };
  /**
   *
   *
   * @param {any} roleName
   * @returns
   */

  const hasRole = function (roleName) {
    let user = JSON.parse(localStorage.getItem('authUser'));

    user = user === null ? false : user;

    let result = user.rolesNames.find((r) => {
      return r.title === roleName;
    });

    return typeof result !== 'undefined';
  };
  /**
   *
   *
   * @param {any} roles
   * @returns
   */

  const hasRoleIn = function (roles) {
    if (!roles || Utilities.isEmpty(roles)) {
      return true;
    }
    return roles.some((role) => {
      return hasRole(role) || role === 'Authenticated';
    });
  };
  /**
   *
   *
   * @param {any} rolesIds
   * @returns
   */

  const hasRoleIdIn = async function (rolesIds) {
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
      return hasRole(role) || role === 'Authenticated';
    });
  };
  /**
   * Checks if the current user is
   * Authenticated
   * @return {boolean}
   */

  const check = function () {
    let user = JSON.parse(localStorage.getItem('authUser'));

    return !!user && !!user.x_jwt_token;
  };
  /**
   * Logs out autheticated user
   *
   */

  const logOut = async function () {
    await localStorage.removeItem('authUser');
    await localStorage.removeItem('formioToken');
    await localStorage.removeItem('formioUser');
  };

  return Object.freeze({
    user,
    email,
    hasRoleIn,
    hasRoleIdIn,
    hasRole,
    check,
    logOut,
    attempt
  });
})();

export default Auth;
