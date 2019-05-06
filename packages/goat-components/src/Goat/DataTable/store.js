import Vue from 'vue';
import { Form, Submission } from '@goatlab/goatjs';
import Columns from './components/formatters/Columns';
import Interceptors from './Interceptors';
import Hooks from './Hooks';

const getInitialStates = () => ({
  rows: [],
  selected: [],
  searchQuery: '',
  paginator: {
    page: 1,
    rowsPerPage: 10,
    rowsNumber: 10
  },
  columns: [],
  path: '',
  form: {}
});

const states = {};

const actions = {
  async populate({ commit }, { id, path, filter, url, pagination, hooks, interceptors }) {
    let context = await Hooks({
      hooks,
      trigger: 'beforePopulate',
      context: { id, path, filter, url, pagination }
    }).process();

    // const form = await Form.find({ path: context.path });

    const interceptor = Interceptors({
      interceptors,
      trigger: 'populate',
      context: {
        path: context.path,
        id: context.id,
        filter: context.filter,
        url: context.url,
        pagination: context.pagination
      }
    });

    const form = await Form.local()
      .where('data.path', '=', context.path)
      .first();

    const columns = Columns.get({
      form: form.data,
      hasCustomColumn: this.hasCustomColumn
    }).map(c => `data.${c.name}`);

    const query = [];

    columns.forEach(c => {
      if (c !== 'data.HumanUpdated') {
        query.push({ [c]: { like: `${filter}`, options: 'i' } });
      }
    });

    const results =
      (await interceptor.process()) ||
      (await Submission({ path: context.path })
        .remote({ connectorName: 'loopback' })
        .raw(filter ? { where: { or: query }, order: 'modified DESC' } : { order: 'modified DESC' })
        .tableView(context.pagination));

    context = await Hooks({
      hooks,
      trigger: 'afterPopulate',
      context: { id, path, filter, url, pagination, results }
    }).process();

    commit('setRows', { id, rows: context.results.data });
    commit('setPagination', { id, paginator: context.results.paginator });
  },
  setPaginator({ commit }, { id, value }) {
    commit('setPagination', { id, paginator: value });
  },
  async setColumns({ commit }, { id, path, exclude }) {
    const form = await Form.local()
      .where('data.path', '=', path)
      .first();
    commit('setPath', { id, path });
    commit('setForm', { id, form: form.data });

    let columns = Columns.get({
      form: form.data,
      hasCustomColumn: this.hasCustomColumn
    });

    if (exclude) {
      columns = columns.filter(c => !exclude.includes(c.field));
    }

    commit('setColumns', { id, columns });
  },
  setSelected({ commit }, { id, value }) {
    commit('setSelected', { id, value });
  },
  setFilter({ commit }, { id, value }) {
    commit('setFilter', { id, value });
  },
  resetTable({ commit }, id) {
    commit('resetTable', id);
  }
};

const mutations = {
  setRows(state, { id, rows }) {
    const object = state[id];
    object.rows = rows;
    Vue.set(state, id, object);
  },
  setPagination(state, { id, paginator }) {
    const object = state[id];
    object.paginator = paginator;
    Vue.set(state, id, object);
  },
  setColumns(state, { id, columns }) {
    const object = state[id];
    object.columns = columns;
    Vue.set(state, id, object);
  },
  setForm(state, { id, form }) {
    const object = state[id];
    object.form = form;
    Vue.set(state, id, object);
  },
  setPath(state, { id, path }) {
    const object = state[id];
    object.path = path;
    Vue.set(state, id, object);
  },
  setSelected(state, { id, value }) {
    const object = state[id];
    object.selected = value;
    Vue.set(state, id, object);
  },
  setFilter(state, { id, value }) {
    const object = state[id];
    object.searchQuery = value;
    Vue.set(state, id, object);
  },
  resetTable(state, id) {
    Vue.set(state, id, getInitialStates());
  }
};

const datatable = {
  state: states,
  mutations,
  actions
};

export default datatable;
