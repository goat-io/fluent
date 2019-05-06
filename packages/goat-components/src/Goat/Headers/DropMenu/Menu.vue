<template>
  <li class="g-header-action-wrapper">
    <q-btn inverted flat no-caps dense class="g-header-menu" icon-right="fas fa-caret-down">
      <i :class="getClass"></i>
      <div>{{ label }}</div>
      <q-chip floating class="floating-chip" v-if="chip">{{ chip }}</q-chip>
      <q-popover class="g-pop-over-menu-header">
        <span class="g-header-menu-arrow"></span>
        <q-list link class="g-menu-popover">
          <slot></slot>
        </q-list>
      </q-popover>
    </q-btn>
  </li>
</template>
<script>
export default {
  name: 'gHeaderMenu',
  props: ['label', 'icon', 'chip'],
  watch: {
    src() {},
    alt() {}
  },
  computed: {
    getClass() {
      return `q-icon on-left ${this.icon}`;
    }
  }
};
</script>
<style lang="scss">
.g-header-menu {
  height: 100%;
  vertical-align: middle;
  outline: none !important;
  .floating-chip {
    position: inherit;
    border-radius: 2rem;
    background-color: #716aca;
    color: white;
    font-size: 0.8rem;
    padding: 1px 10px;
  }

  .q-btn-inner {
    font-weight: 500;
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

.g-header-menu:hover,
.g-header-menu:active {
  height: 100%;
  vertical-align: middle;
  .q-btn-inner {
    color: #716aca;
  }
  .q-icon {
    color: #716aca;
  }
}
.g-menu-popover {
  width: 275px;
  box-shadow: 0px 0px 15px 1px rgba(69, 65, 78, 0.2);
  padding: 20px 0px;
  border-radius: 4px;
  background-color: #fff;
  margin-top: 12px;
  animation: none;
}

.g-header-menu-arrow {
  display: inline-block;
  font-family: 'Metronic';
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  line-height: 1;
  text-decoration: inherit;
  text-rendering: optimizeLegibility;
  text-transform: none;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  position: absolute;
  left: 71px;
  padding-top: 4px;
  animation: none;
}

.g-header-menu-arrow:before {
  content: '\f1b1';
  width: 100%;
  height: 100%;
  font-size: 45px;
  color: white;
}
.g-pop-over-menu-header {
  background: transparent;
  border: none;
  box-shadow: none;
  max-width: 100vw !important;
  margin-top: 22px;
}

@media (max-width: 1024px) {
  .g-header-action-wrapper {
    display: block;
    float: none;
    height: auto;
    padding: 0;
    padding: 10px 0 10px 0;
  }
  .g-pop-over-menu-header {
    background: #2c2e3e;
    margin-top: 0px;
    right: -20px !important;
    left: unset !important;
    .g-menu-popover {
      background: #2c2e3e;
      border: none;
      padding: 10px 20px;
      margin-top: 0px;
    }

    .g-header-menu-arrow::before {
      color: #2c2e3e;
    }

    .g-header-menu-arrow:before {
      display: none;
      font-size: 0px;
    }
  }
}
</style>
