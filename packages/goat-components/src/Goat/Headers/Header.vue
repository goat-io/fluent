<template>
  <QLayoutHeader class="g-header">
    <QToolbar class="g-toolbar" color="white">
      <g-toggle-drawer />
      <div :class="getClass" v-click-outside="closeActionDrawer">
        <ul class="g-action-lists">
          <slot name="left"></slot>
        </ul>
      </div>
      <q-toolbar-title> </q-toolbar-title>
      <div class="g-header-content-right">
        <slot name="right"> </slot>
      </div>
      <g-toggle-action-drawer />
    </QToolbar>
  </QLayoutHeader>
</template>
<script>
import { mapActions } from 'vuex';
import gToggleDrawer from './ToggleDrawer';
import gToggleActionDrawer from './ToggleActionDrawer';

export default {
  name: 'gHeader',
  props: ['color', 'text', 'transform'],
  data() {
    return {
      times: 0
    };
  },
  components: {
    gToggleDrawer,
    gToggleActionDrawer
  },
  computed: {
    ActionDrawerOpen() {
      return this.$store.state.layout.actionDrawerOpen;
    },
    getClass() {
      if (this.ActionDrawerOpen) {
        return 'g-header-content-left';
      }
      return 'g-header-content-left g-hide';
    }
  },
  methods: {
    ...mapActions(['toggleActionDrawer']),
    closeActionDrawer(e) {
      const isToggleButton = e.path.reduce((reducer, element) => {
        if (element.className && element.className.indexOf('g-header-menu-button-toggle') > -1) {
          reducer = true;
        }
        return reducer;
      }, false);
      if (this.$store.state.layout.actionDrawerOpen && !isToggleButton) {
        this.toggleActionDrawer();
      }
    }
  }
};
</script>
<style lang="scss">
@media (min-width: 1025px) {
  .g-header-content-left ul {
    margin-top: 0;
    margin-bottom: 0;
    list-style: none;
    margin: 0;
    padding: 0;
    display: table-row;
    height: 100%;
  }

  .g-toolbar {
    height: 100%;
    padding: 0px 12px;
  }

  .g-header {
    height: 70px;
    box-shadow: 0px 1px 15px 1px rgba(69, 65, 78, 0.1);
    background-color: white !important;
  }
}
@media (max-width: 1024px) {
  .g-header-content-left {
    box-shadow: 0px 1px 15px 1px rgba(69, 65, 78, 0.1);
    display: block;
    height: auto;
    background-color: #2c2e3e !important;
    display: block !important;
    z-index: 1001;
    position: fixed;
    -webkit-overflow-scrolling: touch;
    top: 0;
    bottom: 0;
    overflow-y: auto;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    width: 255px !important;
    right: 0;
    list-style: none;
    padding: 100px 0 30px 0;
  }
  .g-hide {
    display: none !important;
  }
  .g-action-lists {
    list-style: none;
    margin-bottom: 1rem;
    padding-left: 0px;
  }

  .g-header {
    box-shadow: 0px 1px 15px 1px rgba(69, 65, 78, 0.1);
  }
}
</style>
