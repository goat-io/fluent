import to from "await-to-js";
import Utilities from "utilities";
import axios from "axios";
import { Interface } from "@goatlab/goat-fluent";
import Connection from "Wrappers/Connection";

export default Interface.compose({
  methods: {
    getToken() {
      return localStorage.getItem("formioToken");
    },
    baseUrl() {
      const { baseUrl, name } = this.connector;

      if (!baseUrl) {
        throw new Error(
          `You did not provide a baseUrl for the "${name}" connector`
        );
      }
      return baseUrl.replace(/\/+$/, "");
    },
    async paginate(perPage, currentPage) {
      currentPage = currentPage ? currentPage : 1;
      perPage = perPage ? perPage : 15;
      const limit = this.limitNumber < perPage ? this.limitNumber : perPage;
      this.skip((currentPage - 1) * limit);
      this.limit(limit);

      let error;
      let result;

      [error, result] = await to(this.get());

      if (error) {
        console.log(error);
        throw new Error("Error while getting paginated data");
      }

      return result;
    },
    async get() {
      if (this.ownerEmail) {
        this.andWhere("owner", "=", this.ownerEmail);
      }
      let error;
      let result;

      [error, result] = await to(this.httpGET());

      if (error) {
        console.log(error);
        throw new Error("Error while getting submissions");
      }

      result = this.jsApplySelect(result.data);
      result = this.jsApplyOrderBy(result);

      return result;
    },
    async all() {
      return this.get();
    },
    async insert(data, options) {
      if (Array.isArray(data)) {
        return this.ArrayInsert(data, options);
      }
      let [error, result] = await to(this.httpPOST(data));

      if (error) {
        console.log(error);
        throw new Error("Cannot insert data");
      }
      return result.data;
    },
    async update(data) {
      if (!data._id) {
        throw new Error(
          "Formio connector error. Cannot update a Model without _id key"
        );
      }
      if (data._id.includes("_local")) {
        throw new Error(
          "Formio connector error. Cannot update a local document"
        );
      }

      let [error, result] = await to(this.httpPUT(data));

      if (error) {
        console.log(error);
        throw new Error("Cannot insert data");
      }
      return result.data;
    },
    async clear({ sure } = {}) {
      if (!sure || sure !== true) {
        throw new Error(
          'Clear() method will delete everything!, you must set the "sure" parameter "clear({sure:true})" to continue'
        );
      }
      let promises = [];

      let [error, data] = await to(this.select("_id").pluck("_id"));

      if (error) {
        console.log(error);
        throw new Error("Cannot get remote Model");
      }

      data.forEach(_id => {
        promises.push(this.httpDelete(_id));
      });

      return axios.all(promises);
    },
    async remove(_id) {
      let [error, removed] = await to(this.httpDelete(_id));

      if (error) {
        console.log(error);
        throw new Error(`FormioConnector: Could not delete ${_id}`);
      }

      return removed;
    },
    async find(_id) {
      if (typeof _id !== "string") {
        throw new Error(
          'Formio connector find() method only accepts strings "' +
            typeof _id +
            '" given "' +
            _id +
            '"'
        );
      }
      let [error, data] = await to(this.where("_id", "=", _id).first());

      if (error) {
        console.log(error);
        throw new Error("Find() could not get remote data");
      }

      return data;
    },
    getUrl() {
      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined;
      let path = Utilities.get(() => this.remoteConnection.path, undefined);
      const id = Utilities.get(() => this.remoteConnection.id, undefined);
      const pullForm = Utilities.get(
        () => this.remoteConnection.pullForm,
        undefined
      );

      if (!pullForm && path) {
        path = !id ? `${path}/submission` : `${path}/submission/${id}`;
      }

      if (!baseUrl) {
        throw new Error("Cannot get remote model. baseUrl not defined");
      }

      if (path) {
        return `${baseUrl}/${path}`;
      }
      return baseUrl;
    },
    getHeaders() {
      let headers = {};
      let token = localStorage.getItem("formioToken");

      if (this.remoteConnection.token || this.remoteConnection.token === "") {
        token = this.remoteConnection.token;
      }

      if (!token) {
        return headers;
      }

      let type = this.getTokenType(token);
      headers[type] = token;
      return headers;
    },
    getSpacer(url) {
      return url.substr(url.length - 1) === "&" ? "" : "&";
    },
    httpGET() {
      let url = this.getUrl();
      let headers = this.getHeaders();
      let filters = this.getFilters();
      let limit = this.getLimit();
      let skip = this.getSkip();
      let select = this.getSelect();
      let spacer = "";

      // Always limit the amount of requests
      url = url + spacer + limit;

      url = filters ? url + this.getSpacer(url) + filters : url;

      url = skip ? url + this.getSpacer(url) + skip : url;

      url = select ? url + this.getSpacer(url) + select : url;

      if (!Connection.isOnline()) {
        throw new Error(`Cannot make get request to ${url}.You are not online`);
      }

      return axios.get(url, { headers });
    },
    httpPOST(data) {
      let url = this.getUrl();
      let headers = this.getHeaders();

      if (!Connection.isOnline()) {
        throw new Error(
          `Cannot make request post to ${url}.You are not online`
        );
      }
      return axios.post(url, data, { headers });
    },
    httpPUT(data) {
      let url = `${this.getUrl()}/${data._id}`;
      let headers = this.getHeaders();

      if (!Connection.isOnline()) {
        throw new Error(
          `Cannot make request post to ${url}.You are not online`
        );
      }
      return axios.put(url, data, { headers });
    },
    httpDelete(_id) {
      let headers = this.getHeaders();
      let url = `${this.getUrl()}/${_id}`;

      return axios.delete(url, { headers });
    },
    getTokenType(token) {
      if (token.length > 32) {
        return "x-jwt-token";
      }
      return "x-token";
    },
    getFilters() {
      let filter = this.whereArray;

      if (!filter || filter.length === 0) {
        return undefined;
      }

      let filterQuery = "";

      filter.forEach(condition => {
        let valueString = "";
        let element = condition[0];
        let operator = condition[1];
        let value = condition[2];

        switch (operator) {
          case "=":
            filterQuery = filterQuery + element + "=" + value + "&";
            break;
          case "!=":
            filterQuery = filterQuery + element + "__ne=" + value + "&";
            break;
          case ">":
            filterQuery = filterQuery + element + "__gt=" + value + "&";
            break;
          case ">=":
            filterQuery = filterQuery + element + "__gte=" + value + "&";
            break;
          case "<":
            filterQuery = filterQuery + element + "__lt=" + value + "&";
            break;
          case "<=":
            filterQuery = filterQuery + element + "__lte=" + value + "&";
            break;
          case "in":
            valueString = "";
            value.forEach((val, index, array) => {
              valueString =
                index === array.length - 1
                  ? valueString + val
                  : valueString + val + ",";
            });
            filterQuery = filterQuery + element + "__in=" + valueString + "&";
            break;
          case "nin":
            valueString = "";
            value.forEach((val, index, array) => {
              valueString =
                index === array.length - 1
                  ? valueString + val
                  : valueString + val + ",";
            });
            filterQuery = filterQuery + element + "__nin=" + valueString + "&";
            break;
          case "exists":
            filterQuery = filterQuery + element + "__exists=" + true + "&";
            break;
          case "!exists":
            filterQuery = filterQuery + element + "__exists=" + false + "&";
            break;
          case "regex":
            filterQuery = filterQuery + element + "__regex=" + value + "&";
            break;
        }
      });
      return filterQuery.substring(0, filterQuery.length - 1);
    },
    getLimit() {
      let limit = "?limit=";

      if (!this.limitNumber || this.limitNumber === 0) {
        this.limitNumber = 50;
      }

      return `${limit}${this.limitNumber}`;
    },
    getSkip() {
      let skip = "skip=";

      if (!this.offsetNumber) {
        this.offsetNumber = 0;
      }

      return skip + this.offsetNumber;
    },
    getSelect() {
      let select = this.selectArray;

      select = select.map(e => {
        return e.split(" as ")[0];
      });

      if (!select) {
        return;
      }

      return "select=" + select.join(",");
    }
  }
});
