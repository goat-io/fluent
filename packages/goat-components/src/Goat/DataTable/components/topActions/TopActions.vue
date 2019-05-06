<template>
  <div>
    <g-table-create-action
      :args="actionsInclude('create')"
      :id="id"
      :hooks="hooks"
      :interceptors="interceptors"
    />
    <g-table-custom-action
      v-for="action in customActions"
      :args="action"
      :key="action.name"
      :id="id"
    />
    <g-table-review-action
      :args="actionsInclude('review')"
      :id="id"
      :hooks="hooks"
      :interceptors="interceptors"
    />
    <g-table-read-only-action
      :args="actionsInclude('read-only')"
      :id="id"
      :hooks="hooks"
      :interceptors="interceptors"
    />
    <g-table-edit-action
      :args="actionsInclude('edit')"
      :id="id"
      :hooks="hooks"
      :interceptors="interceptors"
    />
    <g-table-import-action
      :args="actionsInclude('export')"
      :id="id"
      :hooks="hooks"
      :interceptors="interceptors"
    />
    <g-table-delete-action
      :args="actionsInclude('delete')"
      :id="id"
      :hooks="hooks"
      :interceptors="interceptors"
      @refresh="$emit('refresh')"
    />
  </div>
</template>

<script>
import gTableReviewAction from './Review';
import gTableReadOnlyAction from './ReadOnly';
import gTableEditAction from './Edit';
import gTableDeleteAction from './Delete';
import gTableImportAction from './Import';
import gTableCreateAction from './Create';
import gTableCustomAction from './Custom';

export default {
  name: 'gTopAction',
  components: {
    gTableReviewAction,
    gTableReadOnlyAction,
    gTableEditAction,
    gTableDeleteAction,
    gTableImportAction,
    gTableCreateAction,
    gTableCustomAction
  },
  props: ['actions', 'id', 'hooks', 'interceptors'],
  watch: {
    path() {},
    actions() {},
    hooks() {},
    interceptors() {}
  },
  computed: {
    customActions() {
      if (!this.actions) {
        return [];
      }
      return this.actions.filter(a => a && a.type && a.type === 'custom');
    }
  },
  methods: {
    actionsInclude(name) {
      if (!this.actions) {
        return false;
      }

      const isPresent = this.actions.findIndex(action => {
        if (typeof action === 'string') {
          return action === name;
        }
        return action.name === name;
      });

      return isPresent > -1 ? this.actions[isPresent] : undefined;
    }
  }
};
</script>
