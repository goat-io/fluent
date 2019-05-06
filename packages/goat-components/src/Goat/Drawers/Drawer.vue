<template>
  <QLayoutDrawer :width="255" class="sidebar g-drawer" side="left" v-model="displayDrawer">
    <QList class="flex-drawer" no-border link>
      <div>
        <slot></slot>
      </div>
    </QList>
  </QLayoutDrawer>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'gDrawer',
  props: ['color', 'show'],
  data() {
    return {
      displayDrawer: true
    };
  },
  watch: {
    show(value) {
      this.displayDrawer = value;
    },
    drawerOpen(value) {
      this.displayDrawer = value;
    },
    displayDrawer(value) {
      if (this.$store.state.layout.drawerOpen !== value) {
        this.toggleDrawer();
      }
    }
  },
  computed: {
    drawerOpen() {
      return this.$store.state.layout.drawerOpen;
    }
  },
  methods: {
    ...mapActions(['toggleDrawer'])
  }
};
</script>
<style lang="scss">
@import '../Themes/Metronic/variables.scss';
.g-drawer {
  padding: 30px 0 30px 0;
}

.g-drawer .q-layout-drawer {
  background-color: $drawerBg;
  overflow-x: hidden;
  box-shadow: none;
}

.g-drawer .q-layout-drawer > .q-list {
  padding-top: 0;
}

.g-drawer .drawer-item {
  height: 44px;
  padding: 9px 30px;
}
</style>
