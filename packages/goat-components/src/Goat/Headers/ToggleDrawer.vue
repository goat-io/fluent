<template>
  <q-btn
    inverted
    flat
    no-caps
    class="g-header-toggle"
    dense
    icon="menu"
    @click.native="toggleDrawer"
  />
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'gToggleDrawer',
  props: ['icon'],
  watch: {
    icon() {}
  },
  methods: {
    ...mapActions(['toggleDrawer'])
  }
};
</script>

<style lang="scss">
.g-header-toggle {
  height: 100%;
  vertical-align: middle;
  outline: none !important;
  .q-icon {
    color: #b8bece;
    font-size: 1.9rem;
    padding: 0;
    width: 26px;
    height: 26px;
    line-height: 0;
  }
}

.g-header-toggle:hover {
  height: 100%;
  vertical-align: middle;
  .q-icon {
    color: #716aca;
  }
}
</style>
