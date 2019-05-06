<template>
  <QItem class="drawer-item" @click.native="$router.push(to)">
    <QItemSide class="g-drawer-link-icon">
      <i :class="getClass"></i>
    </QItemSide>
    <QItemMain :label="label" class="g-drawer-link-label" />
  </QItem>
</template>

<script>
export default {
  name: 'gDrawerLink',
  props: ['icon', 'label', 'to'],
  computed: {
    getClass() {
      return `${this.icon} g-icon-drawer`;
    }
  },
  watch: {
    icon() {},
    label() {},
    to() {}
  }
};
</script>
<style lang="scss">
@import '../Themes/Metronic/variables.scss';

.g-drawer-link-label .q-item-label {
  height: 100%;
  width: 100%;
  padding: 0;
  vertical-align: middle;
  line-height: 1.5;
  font-weight: 400;
  font-size: 1.02rem;
  text-transform: initial;
  color: $drawerLink;
}

.g-drawer-link-icon > .g-icon-drawer {
  color: $drawerLinkIcon;
  text-align: left;
  width: 35px;
  font-size: 1.7rem;
}

.g-drawer .drawer-item > .q-item-label {
  margin: 0;
  line-height: 30px;
  font-size: 14px;
  position: relative;
  display: block;
  height: auto;
  white-space: nowrap;
}

.g-drawer .drawer-item:hover {
  background-color: $drawerLinkBgHover;
  cursor: pointer;
}

.g-drawer .drawer-item:hover .g-drawer-link-icon > .g-icon-drawer {
  color: $drawerLinkIconHover;
  cursor: pointer;
}
</style>
