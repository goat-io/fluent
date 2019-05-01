import to from "await-to-js";
import Utilities from "./Utilities";
import axios from "axios";
import { Interface, Fluent } from "@goatlab/goat-fluent";
import Connection from "./Wrapers/Connection";

export default Interface.compose({
  methods: {
    baseUrl() {
      const { baseUrl, name } = this.connector;

      if (!baseUrl) {
        throw new Error(
          `You did not provide a baseUrl for the "${name}" connector`
        );
      }
      return baseUrl.replace(/\/+$/, "");
    },
    async get() {
      if (this.ownerId) {
        this.andWhere("owner", "=", this.ownerId);
      }
      let error;
      let result;

      [error, result] = await to(this.httpGET());

      if (error) {
        console.log(error);
        throw new Error("Error while getting submissions");
      }

      if (
        result &&
        result.data &&
        result.data.hasOwnProperty("meta") &&
        this.selectArray.length > 0
      ) {
        result.data.data = this.jsApplySelect(result.data.data);
        return [result.data];
      }

      return this.jsApplySelect(result && result.data);
    },
    async all() {
      return this.get();
    },
    async paginate(paginator) {
      if (!paginator) throw new Error("Paginator cannot be empty");
      this.paginator = paginator;
      const results = {};
      const response = await this.get();
      if (!response[0]) {
        throw new Error("The query was not paginated");
      }
      results.data = response[0].data;
      results.paginator = {
        page: response[0].meta.currentPage,
        rowsPerPage: response[0].meta.itemsPerPage,
        rowsNumber: response[0].meta.totalItemCount
      };

      return results;
    },
    raw(query) {
      if (!query) throw new Error("No query was received");
      this.rawQuery = query;
      return this;
    },
    async insert(data) {
      if (!Array.isArray(data)) {
        await this.validate(data);
      }

      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined;
      const remotePath = Utilities.get(
        () => this.remoteConnection.path,
        undefined
      );
      const form = await this.getForm(baseUrl, remotePath);

      const headers = this.getHeaders();

      const postData = { data, form: form._id, ...headers };

      let [error, result] = await to(this.httpPOST(postData));

      if (error) {
        throw new Error("Cannot insert data");
      }
      return result.data;
    },
    async tableView(paginator) {
      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined;
      const remotePath = Utilities.get(
        () => this.remoteConnection.path,
        undefined
      );
      const form = await this.getForm(baseUrl, remotePath);
      if (!form) throw new Error("Could not find form");

      const components = form.components;
      let finalComponents = this.getTableViewComponents(components);
      finalComponents = [
        ...finalComponents,
        "id as _id",
        "modified as HumanUpdated"
      ];
      this.select(finalComponents);

      return this.paginate(paginator);
    },
    getTableViewComponents(components) {
      return Utilities.findComponents(components, {
        input: true,
        tableView: true
      })
        .filter(c => !!(c.label !== ""))
        .map(c => `data.${c.key} as ${c.key}`);
    },
    /* async update(data) {
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
    }, */
    /* async clear({ sure } = {}) {
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
    }, */
    /* async remove(_id) {
      let [error, removed] = await to(this.httpDelete(_id));

      if (error) {
        console.log(error);
        throw new Error(`FormioConnector: Could not delete ${_id}`);
      }

      return removed;
    }, */
    /* async find(_id) {
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
    }, */
    async getForm(baseUrl, path) {
      let Config = Fluent.model({
        properties: {
          name: "Form",
          config: {
            remote: {
              path: "form",
              pullForm: true
            }
          }
        }
      })();
      const form = await Config.local()
        .where("data.path", "=", path)
        .first();

      return form.data;
    },
    getUrl() {
      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined;

      return `${baseUrl}/submissions`;
    },
    getHeaders() {
      let headers = {};
      let token = {};
      if (typeof localStorage !== "undefined") {
        token = localStorage.getItem("formioToken");
      }

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
    getPage() {
      let page = "page=";
      if (this.paginator && this.paginator.page) {
        return page + this.paginator.page + "&";
      }

      return "";
    },
    getPaginatorLimit(filter) {
      if (this.paginator && this.paginator.rowsPerPage) {
        return { ...filter, limit: this.paginator.rowsPerPage };
      }

      return filter;
    },
    async httpGET() {
      let filter = {};
      let url = this.getUrl();
      const headers = this.getHeaders();
      filter = await this.getFilters(filter);
      filter = this.getLimit(filter);
      filter = this.getSkip(filter);
      filter = this.getSelect(filter);
      filter = this.getOrderBy(filter);
      filter = this.getPaginatorLimit(filter);
      const page = this.getPage();

      if (this.rawQuery) {
        filter.limit = filter.limit || this.rawQuery.limit;
        filter.skip = filter.skip || this.rawQuery.skip;
        filter.order = filter.order || this.rawQuery.order;
        filter.fields = { ...filter.fields, ...this.rawQuery.fields };
        filter.where = { ...filter.where.and[0], ...this.rawQuery.where };
      }

      filter.where = {
        ...filter.where,
        ...{ deleted: null }
      };

      // Always limit the amount of request
      url = `${url}?${page}filter=${encodeURI(JSON.stringify(filter))}`;

      const isOnline = true || (await Connection.isOnline());

      if (!isOnline) {
        throw new Error(`Cannot make get request to ${url}.You are not online`);
      }

      return axios.get(url, { headers });
    },
    async httpPOST(data) {
      let url = this.getUrl();
      let headers = this.getHeaders();
      const isOnline = true || (await Connection.isOnline());

      if (!isOnline) {
        throw new Error(
          `Cannot make request post to ${url}.You are not online`
        );
      }
      return axios.post(url, data, { headers });
    },
    /* async httpPUT(data) {
      const isOnline = true || await Connection.isOnline();
      let url = `${this.getUrl()}/${data._id}`;
      let headers = this.getHeaders();

      if (!isOnline) {
        throw new Error(
          `Cannot make request post to ${url}.You are not online`
        );
      }
      return axios.put(url, data, { headers });
    }, */
    /* httpDelete(_id) {
      let headers = this.getHeaders();
      let url = `${this.getUrl()}/${_id}`;

      return axios.delete(url, { headers });
    }, */
    getTokenType(token) {
      if (token.length > 32) {
        return "x-jwt-token";
      }
      return "x-token";
    },
    async getFilters(filters) {
      let filter = this.whereArray;
      const baseUrl = this && this.baseUrl() ? this.baseUrl() : undefined;
      const remotePath = Utilities.get(
        () => this.remoteConnection.path,
        undefined
      );
      const form = await this.getForm(baseUrl, remotePath);
      filters["where"] = { and: [] };

      if (form._id) {
        filters.where.and.push({ form: form._id });
      }

      if (!filter || filter.length === 0) {
        return filters;
      }

      filter.forEach(condition => {
        let element = condition[0];
        let operator = condition[1];
        let value = condition[2];

        switch (operator) {
          case "=":
            filters.where.and.push({ [element]: value });
            break;
          case "!=":
            filters.where.and.push({ [element]: { neq: value } });
            break;
          case ">":
            filters.where.and.push({ [element]: { gt: value } });
            break;
          case ">=":
            filters.where.and.push({ [element]: { gte: value } });
            break;
          case "<":
            filters.where.and.push({ [element]: { lt: value } });
            break;
          case "<=":
            filters.where.and.push({ [element]: { lte: value } });
            break;
          case "in":
            filters.where.and.push({ [element]: { inq: value } });
            break;
          case "nin":
            filters.where.and.push({ [element]: { nin: value } });
            break;
          case "exists":
            filters.where.and.push({ [element]: { exists: true } });
            break;
          case "!exists":
            filters.where.and.push({ [element]: { exists: false } });
            break;
          case "regex":
            filters.where.and.push({ [`data.${element}`]: { regexp: value } });
            break;
        }
      });

      return filters;
    },
    getOrderBy(filter) {
      if (!this.orderByArray || this.orderByArray.length === 0) {
        return filter;
      }

      return {
        ...filter,
        order: `${this.orderByArray[0]} ${this.orderByArray[1].toUpperCase()}`
      };
    },
    getLimit(filter) {
      if (!this.limitNumber || this.limitNumber === 0) {
        this.limitNumber = (this.rawQuery && this.rawQuery.limit) || 50;
      }

      return { ...filter, limit: this.limitNumber };
    },
    getSkip(filter) {
      if (!this.offsetNumber) {
        this.offsetNumber = (this.rawQuery && this.rawQuery.skip) || 0;
      }

      return { ...filter, skip: this.offsetNumber };
    },
    getSelect(filter) {
      let select = this.selectArray;

      select = select.map(s => {
        s = s.split(" as ")[0];
        s = s.includes("_id") ? "id" : s;
        return s;
      });

      if (select.find(e => e.startsWith("data."))) {
        select.unshift("data");
      }

      if (!select) {
        return filter;
      }

      const fields = {};

      select.forEach(e => {
        fields[e] = true;
      });

      return { ...filter, fields };
    }
  }
});
