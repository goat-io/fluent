<template>
  <q-card class="g-datatable-container">
    <q-card-title class="g-datatable-title"> <i :class="getClass()"></i> {{ title }} </q-card-title>
    <q-card-separator />
    <q-card-main style="padding: 0px; min-height: 150px" class="relative-position">
      <q-table
        :key="$vnode.key"
        :ref="$vnode.key"
        color="brand"
        :data="tableData"
        :columns="tableColumns"
        :loading="loading"
        :filter="filter"
        :rows-per-page-options="[10, 50, 100, 200]"
        :selection="'multiple'"
        :selected.sync="selected"
        :pagination.sync="tablePagination"
        @request="loadData"
        row-key="_id"
        class="no-shadow"
      >
        <!-- Top actions when table row is selected -->
        <template slot="top-selection" slot-scope="scope">
          <g-top-action
            :id="$vnode.key"
            :actions="actions"
            :hooks="hooks"
            :interceptors="interceptors"
            @refresh="update()"
          />
        </template>

        <!-- Top Searchbox filter -->
        <template slot="top-left" slot-scope="props">
          <q-search hide-underline v-model="filter" />
        </template>

        <q-tr slot="body" slot-scope="scope" @click.native="rowClick(scope)" class="cursor-pointer">
          <q-td auto-width>
            <q-checkbox color="grey-5" v-model="scope.selected" />
          </q-td>
          <q-td v-for="col in scope.cols" :key="col.name" class="g-td">
            <template v-if="customColumns.some(c => c.name === col.name)">
              <slot :name="`${col.name}`" :scope="scope" v-if="!getCustomComponent(col.name)" />
              <component :is="getCustomComponent(col.name)" :scope="scope" :key="col.name" />
            </template>
            <template v-else-if="col.name === 'HumanUpdated'">
              {{ parseDate(col.value) }}
            </template>
            <template v-else>
              {{ col.value }}
            </template>
          </q-td>
        </q-tr>
        <!-- Top Searchbox filter -->
        <template
          :slot="`body-cell-${column.name}`"
          slot-scope="scope"
          v-for="column in customColumns"
        >
          <slot :name="`${column.name}`" :scope="scope" v-if="!column.component" />
          <component :is="column.component" :scope="scope" :key="column.name" />
        </template>

        <template slot="col-status" slot-scope="scope">
          <g-table-row-status :scope="scope" />
        </template>
      </q-table>
    </q-card-main>

    <q-inner-loading :visible="loading">
      <q-spinner-puff size="90px" color="green"></q-spinner-puff>
    </q-inner-loading>
  </q-card>
</template>

<script>
import { mapActions } from 'vuex';
import _get from 'lodash.get';
import moment from 'moment';
import exportMenu from './components/export/exportMenu';
import gTopAction from './components/topActions/TopActions';
import gTableRowStatus from './components/Status';

export default {
  components: {
    exportMenu,
    gTopAction,
    gTableRowStatus
  },
  name: 'gDataTable',
  props: [
    'data',
    'path',
    'title',
    'icon',
    'actions',
    'exclude',
    'hooks',
    'interceptors',
    'customColumns'
  ],
  async created() {
    this.$store.dispatch('resetTable', this.$vnode.key);
  },
  async mounted() {
    const colsValue = { id: this.$vnode.key, path: this.path, exclude: this.exclude };
    await this.$store.dispatch('setColumns', colsValue);
    await this.loadData({
      pagination: this.tablePagination,
      filter: this.filter
    });
  },
  beforeDestroy() {
    this.$store.dispatch('resetTable', this.$vnode.key);
  },
  data() {
    return {
      serverData: [],
      loading: false,
      show: true,
      config: {
        refresh: false,
        noHeader: false,
        columnPicker: false,
        leftStickyColumns: 0,
        rightStickyColumns: 0,
        rowHeight: '50px',
        responsive: false,
        messages: {
          noData: this.$t('No data available to show.'),
          noDataAfterFiltering: this.$t('No results. Please refine your search terms.')
        },
        // (optional) Override default labels. Useful for I18n.
        labels: {
          columns: this.$t('Columns'),
          allCols: this.$t('All Columns'),
          rows: this.$t('Rows'),
          selected: {
            singular: this.$t('item selected.'),
            plural: this.$t('items selected.')
          },
          clear: this.$t('Clear Selection'),
          search: this.$t('Search'),
          all: this.$t('All')
        },
        selection: this.mode !== 'editGrid' ? 'multiple' : false
      }
    };
  },
  watch: {
    data() {},
    path() {},
    actions() {}
  },
  methods: {
    ...mapActions(['populate', 'setPaginator', 'setColumns', 'setSelected', 'setFilter']),
    async loadData({ pagination, filter }) {
      this.loading = true;
      await this.populate({
        id: this.$vnode.key,
        path: this.path,
        pagination,
        filter,
        hooks: this.hooks,
        interceptors: this.interceptors,
        url: this.$appConf.expressBaseUrl
      });
      this.loading = false;
    },
    getClass() {
      let tClass = 'g-datatable-icon';
      if (this.icon) {
        tClass = `${tClass} ${this.icon}`;
      }
      return tClass;
    },
    rowClick(params) {
      const exists = this.selected.some(s => s._id === params.row._id);
      let selection = [...this.selected, params.row];
      if (exists) {
        selection = [...this.selected.filter(s => s._id !== params.row._id)];
      }
      this.setSelected({ id: this.$vnode.key, value: selection });
    },
    getCustomComponent(name) {
      const result = this.customColumns.filter(c => c.name === name);
      if (result.length > 0) {
        return result[0].component;
      }
      return false;
    },
    update() {
      return this.loadData({
        pagination: this.tablePagination,
        filter: this.filter
      });
    },
    parseDate(date) {
      return Number.isInteger(date) ? moment.unix(date).fromNow() : moment(date).fromNow();
    }
  },
  computed: {
    tableData() {
      return _get(this.$store.state.datatable, `[${this.$vnode.key}].rows`, []);
    },
    /* eslint-disable */
    tablePagination: {
      // eslint-disable-next-line
      get: function() {
        return _get(this.$store.state.datatable, `[${this.$vnode.key}].paginator`, {});
      },
      set: function(value) {
        this.setPaginator({ id: this.$vnode.key, value });
      }
    },
    selected: {
      // eslint-disable-next-line
      get: function() {
        return _get(this.$store.state.datatable, `[${this.$vnode.key}].selected`, []);
      },
      set: function(value) {
        this.setSelected({ id: this.$vnode.key, value });
      }
    },
    filter: {
      // eslint-disable-next-line
      get: function() {
        return _get(this.$store.state.datatable, `[${this.$vnode.key}].searchQuery`, '');
      },
      set: function(value) {
        this.setFilter({ id: this.$vnode.key, value });
      }
    },
    /* eslint-enable */
    tableColumns() {
      const cols = JSON.parse(
        JSON.stringify(_get(this.$store.state.datatable, `[${this.$vnode.key}].columns`, []))
      );
      // Translate Labels
      cols.map(c => {
        c.label = this.$t(c.label);
        return c;
      });
      return cols;
    }
  }
};
</script>
<style lang="scss">
.g-chip-info {
  background-color: #36a3f7;
  color: #fff;
}
.g-chip-success {
  background-color: #34bfa3;
  color: #fff;
}
.q-table-top {
  background: white;
  position: -webkit-sticky;
  position: sticky;
  top: 0px;
  background: white;
  z-index: 100;
}

.g-td {
  color: #6c7293;
  text-overflow: ellipsis;
  font-size: 1rem !important;
  font-weight: 300 !important;
  font-family: Poppins;
  border-color: #f0f3ff !important;
}

.q-table th {
  color: #6c7293;
  font-weight: 600;
  vertical-align: middle;
  text-align: left !important;
  font-size: 1rem;
  /* font-family: 'Popins'; */
  font-family: Poppins;
}

.g-datatable-title .q-card-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #464457;
}

.g-datatable-icon {
  color: #cbcdd4 !important;
  font-size: 1.5rem;
}
.g-datatable-container {
  margin-top: 30px;
}
</style>
