<template>
  <q-btn
    inverted
    flat
    no-caps
    class="g-header-menu g-header-menu-button-toggle"
    dense
    @click.native="toggleActionDrawer"
  >
    <i class="flaticon-more"></i>
  </q-btn>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'gToggleActionDrawer',
  props: ['icon'],
  watch: {
    icon() {}
  },
  methods: {
    ...mapActions(['toggleActionDrawer'])
  }
};
</script>

<style lang="scss">
.g-header-menu-button-toggle i {
  color: #9193a9;
  position: relative;
  font-size: 1.4rem;
}

@media (min-width: 1025px) {
  .g-header-menu-button-toggle {
    display: none;
  }
}
</style>
