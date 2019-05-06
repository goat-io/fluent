<template>
  <li class="g-header-action-wrapper">
    <q-btn
      inverted
      flat
      no-caps
      class="g-header-action"
      dense
      @click.native="
        closeDrawer();
        to ? $router.push(to) : null;
      "
    >
      <i :class="getClass"></i>
      <div>{{ label }}</div>
    </q-btn>
  </li>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'gHeaderAction',
  props: ['label', 'icon', 'to'],
  watch: {
    label() {},
    icon() {},
    to() {}
  },
  computed: {
    getClass() {
      return `q-icon on-left ${this.icon}`;
    }
  },
  methods: {
    ...mapActions(['toggleActionDrawer']),
    closeDrawer() {
      if (this.$store.state.layout.actionDrawerOpen) {
        this.toggleActionDrawer();
      }
    }
  }
};
</script>

<style lang="scss">
@media (min-width: 1025px) {
  .g-header-action-wrapper {
    position: relative;
    height: 100%;
    display: table-cell;
    vertical-align: middle;
  }
}

@media (max-width: 1024px) {
  .g-header-action-wrapper {
    display: block;
    float: none;
    height: auto;
    padding: 0;
    padding: 10px 0 10px 0;
  }
}

.g-header-action {
  height: 100%;
  vertical-align: middle;

  outline: none !important;

  .q-btn-inner {
    font-weight: 400;
    font-size: 1.07rem;
    text-transform: initial;
    color: #676c7b;
  }
  .q-icon {
    color: #b8bece;
    font-size: 1.4rem;
    width: 30px;
    text-align: left;
    padding: 0;
    line-height: 0;
  }
}

.g-header-action:hover {
  height: 100%;
  vertical-align: middle;
  .q-btn-inner {
    color: #716aca;
  }
  .q-icon {
    color: #716aca;
  }
}
</style>
