<template>
  <div class="drawer-header">
    <g-header-logo :src="logo" :alt="alt" />
  </div>
</template>

<script>
import gHeaderLogo from "./Logo";

export default {
  name: "gDrawerHeader",
  components: {
    gHeaderLogo
  },
  props: ["logo", "alt"],
  watch: {
    src() {},
    alt() {}
  }
};
</script>

<style lang="scss">
@import "../../Themes/Metronic/variables.scss";
.g-drawer {
  padding-bottom: 30px;

  .drawer-header {
    width: 100%;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    background-color: $drawerHeaderBg;
    height: 70px;
    margin-bottom: 30px;
  }
  .g-header-logo-container {
    bottom: 0;
    text-align: "center";
  }

  .g-header-logo {
    position: "relative";
    height: 35px;
    width: "auto";
    filter: grayscale(100%);
  }
}
</style>
