<template>
  <div class="g-drawer-version">
    <div class="g-version">{{ version }}</div>
  </div>
</template>

<script>
export default {
  name: "gDrawerVersion",
  props: ["version"],
  watch: {
    version() {}
  }
};
</script>
<style lang="scss">
@import "../../Themes/Metronic/variables.scss";
.g-drawer-version {
  bottom: 0px;
  position: absolute;
  text-align: center;
  width: 100%;
}

.g-version {
  color: $drawerLink;
  margin-bottom: 15px;
  font-weight: 600;
}
</style>
