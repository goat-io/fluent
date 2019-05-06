<template>
  <q-btn color="brand" flat @click="handleCustom()" class="g-table-action-create" v-if="args">
    <q-icon name="fas fa-plus" class="g-table-create-icon" />
    <span class="g-table-action-label">{{ $t(_label) }} </span>
    <q-tooltip>{{ $t(_tooltip) }}</q-tooltip>
  </q-btn>
</template>

<script>
// import { Submission, Auth } from '@goatlab/goatjs';
// import createSubmission from 'components/createSubmission';
// import Hooks from '../../Hooks';
// import Interceptors from '../../Interceptors';

export default {
  name: 'gTableCustomAction',
  props: ['args', 'id'],
  methods: {
    async handleCustom() {
      if (!this.args || !this.args.handle) {
        throw Error('You must implement the handle() method, nothing to do!');
      }
      const context = {
        id: this.id,
        selected: this.$store.state.datatable[this.id].selected
      };
      return this.args.handle(context);
    }
  },
  computed: {
    _label() {
      return (this.args && this.args.label) || 'Custom';
    },
    _tooltip() {
      return (this.args && this.args.tooltip) || 'Custom';
    }
  }
};
</script>
<style lang="scss">
.g-table-action-create {
  background-color: #5d78ff;
  border-color: #5d78ff;
  color: white;
  position: absolute;
  right: 30px;
  top: 15px;
  .q-icon {
    font-size: 1.1em;
  }
}
.g-table-action-label {
  padding-left: 0.5em;
  font-size: 1rem;
  font-weight: 400;
  font-family: Poppins;
  text-transform: none;
}
.g-table-create-icon {
  padding-right: 0.5rem;
  vertical-align: middle;
  line-height: 0;
}
</style>
