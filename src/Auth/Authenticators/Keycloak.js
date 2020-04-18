import stampit from '@stamp/it';
import qs from 'qs';
import btoa from 'btoa';
import axios from 'axios';
import AuthInterface from '../AuthInterface';

export default AuthInterface.compose({
  init({ baseUrl }) {
    this.url.baseUrl = baseUrl;
  },
  properties: {
    url: {
      baseUrl: undefined,
      loginUrl: '/realms/users/protocol/openid-connect/token',
      logoutUrl: '/realms/users/protocol/openid-connect/logout'
    },
    serviceAccount: {
      clientId: 'goat-client',
      secretId: '4ec6a304-2377-4d55-bf3f-ca32b97ec600'
    }
  },
  methods: {
    checkUrl() {
      if (this.url.baseUrl) return this.url.baseUrl;

      throw new Error('No url found for Keycloak connector');
    },
    async logout() {
      const url = `${this.url.baseUrl}${this.url.loginUrl}`;
      const result = await fetch(
        url,
        {
          method: 'POST',
          body: qs.stringify({
            client_id: this.serviceAccount.clientId,
            refresh_token: localStorage.getItem('refreshToken')
          }),
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    },
    async refreshServiceAccount() {
      const url = `${this.url.baseUrl}${this.url.loginUrl}`;
      const query = await fetch(
        url,
        {
          method: 'POST',
          body: qs.stringify({
            client_id: this.serviceAccount.clientId,
            grant_type: 'refresh_token',
            refresh_token: localStorage.getItem('refreshToken')
          }),
          headers: {
            'content-type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const result = await query.json();

      localStorage.setItem('token', result.access_token);
      localStorage.setItem('refreshToken', result.refresh_token);
    },
    async loginServiceAccount() {
      const url = `${this.url.baseUrl}${this.url.loginUrl}`;
      const auth = btoa(`${this.serviceAccount.clientId}:${this.serviceAccount.secretId}`);
      let query = await fetch(
        url,
        {
          method: 'POST',
          body: qs.stringify({
            'grant_type': 'client_credentials'
          }),
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const result = await query.json();

      localStorage.setItem('token', result.access_token);
      localStorage.setItem('refreshToken', result.refresh_token);
    },
    async attempt(credentials, role) {
      console.log(this.url);
      await this.loginServiceAccount();

      return this.serviceAccount;
    }
  }
});
