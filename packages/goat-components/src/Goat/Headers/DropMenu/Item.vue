<template>
  <QItem
    v-close-overlay
    class="menu-item"
    @click.native="
      closeDrawer();
      to ? $router.push(to) : null;
    "
  >
    <q-item-side>
      <i :class="getClass"></i>
    </q-item-side>
    <QItemMain :label="label" class="menu-item-label" />
    <q-item-side right>
      <q-chip class="menu-item-badge" v-if="number">
        {{ number }}
      </q-chip>
    </q-item-side>
  </QItem>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  name: 'gHeaderMenuItem',
  props: ['label', 'icon', 'to', 'number'],
  watch: {
    label() {},
    icon() {},
    to() {}
  },
  computed: {
    getClass() {
      return `menu-item-icon ${this.icon}`;
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
.menu-item {
  padding: 9px 20px;
  cursor: pointer;
  .menu-item-icon {
    color: #b8bece;
    font-size: 1.4rem;
    width: 33px;
    text-align: left;
    padding: 0;
    line-height: 0;
    min-width: unset;
  }

  .menu-item-label {
    color: #676c7b;
    font-weight: 400;
    font-size: 1rem;
    text-transform: initial;
    margin-left: 0px;
  }

  .menu-item-badge {
    background-color: #34bfa3;
    color: #fff;
    font-weight: 600;
    font-size: 0.8rem;
    line-height: 20px;
    min-height: 20px;
    min-width: 20px;
    vertical-align: middle;
    text-align: center;
    display: inline-block;
    padding: 0px 3px;
    border-radius: 0.75rem;
  }
}

.menu-item:hover {
  background: white !important;
  .menu-item-icon,
  .menu-item-label {
    color: #716aca;
    background: white;
  }
}
</style>
