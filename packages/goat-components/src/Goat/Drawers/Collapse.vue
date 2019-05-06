<template>
  <q-collapsible :icon="icon" :label="label" class="g-drawer-collapse">
    <slot></slot>
  </q-collapsible>
</template>

<script>
export default {
  name: "gDrawerCollapse",
  props: ["icon", "label"],
  watch: {
    icon() {},
    label() {}
  }
};
</script>
<style lang="scss">
@import "../Themes/Metronic/variables.scss";
.g-drawer-collapse .q-collapsible-inner {
  padding: 9px 10px;
}

.g-drawer-collapse .q-collapsible-inner .q-item-side {
  color: $drawerLinkIcon;
  text-align: left;
  width: 35px;
  font-size: 1.4rem;
  font-weight: 300;
  cursor: pointer;
  margin: 0;
  line-height: 30px;
  font-size: 14px;
  position: relative;
  display: block;
  height: auto;
  white-space: nowrap;
}

.g-drawer-collapse .q-collapsible-inner .q-item-label {
  margin: 0;
  line-height: 30px;
  font-size: 14px;
  position: relative;
  height: auto;
  white-space: nowrap;
  height: 100%;
  width: 100%;
  padding: 0;
  vertical-align: middle;
  line-height: 1.5;
  font-weight: 400;
  font-size: 1.02rem;
  text-transform: initial;
  color: $drawerLink;
  overflow: inherit !important;
}

.g-drawer-collapse .q-item-main.q-item-section {
  margin-left: 5px;
}

.g-drawer-collapse:hover .q-collapsible-inner .q-item-side {
  color: $drawerLinkIconHover;
  cursor: pointer;
}

.g-drawer-collapse:hover {
  background-color: $drawerLinkBgHover;
}
</style>
