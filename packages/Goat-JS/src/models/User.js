import axios from 'axios';
import Configuration from './Configuration';
import Utilities from 'utilities';
import { Fluent } from "@goatlab/goat-fluent";
import Connection from '../Wrappers/Connection';
import to from 'await-to-js';
import Form from '../models/Form';

export default Fluent.model({
  properties: {
    name: 'User',
    config: {
      remote: {
        path: 'user',
        token: undefined
      }
    }
  },
  methods: {
    async storeLocally(user) {
      let localUser = await this.local()
        .where('data.email', '=', user.data.email)
        .first();

      user = Utilities.deleteNulls(user);
      let isUserAlreadyStored = !!localUser && !Utilities.isEmpty(localUser);

      //  check if user is already present in local storage
      if (isUserAlreadyStored) {
        throw new Error('The user email is already taken');
      }

      if (Connection.isOnline()) {
        let [error, onlineUser] = await to(
          Form.getModel({ path: 'userregister' })
            .remote()
            .insert(user)
        );

        if (error) {
          throw new Error('The user email is already taken');
        }
        return this.local().insert(onlineUser);
      }

      return this.local().insert(user);
    },
    async updateUser(user) {
      let localUser = await this.local()
        .where('data.email', '=', user.data.email)
        .pluck('_id');

      localUser.forEach(async (_id) => {
        await this.local().remove(_id);
      });

      user = Utilities.deleteNulls(user);

      return this.local().insert(user);
    },
    async login({ credentials, role }) {
      let url = (await Configuration.local().first()).APP_URL;

      if (role === 'admin') {
        url = url + '/admin/login';
      } else {
        url = url + '/user/login';
      }
      return axios.post(url, {
        data: credentials
      });
    }
  }
})();
