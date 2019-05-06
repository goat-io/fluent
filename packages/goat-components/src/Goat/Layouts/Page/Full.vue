<template>
  <div class="g-page-wrapper">
    <div class="g-page-subheader">
      <div class="g-container-aling">
        <div class="mr-auto">
          <h3 class="g-page-title">{{ title }}</h3>
          <div class="g-breadcrumb-container">
            <slot name="breadcrumb"> </slot>
          </div>
        </div>
      </div>
    </div>
    <div class="g-page-content"><slot> </slot></div>
  </div>
</template>

<script>
import gBreadcrumb from "../../Breadcrumb/Breadcrumb";
import gBreadcrumbEl from "../../Breadcrumb/Element";
import gBreadcrumbSeparator from "../../Breadcrumb/Separator";
import gHeaderMenuItem from "../../Headers/DropMenu/Item";

export default {
  name: "gPageLayoutFull",
  props: ["title"],
  components: {
    gBreadcrumb,
    gBreadcrumbEl,
    gBreadcrumbSeparator,
    gHeaderMenuItem
  },
  watch: {
    title() {}
  }
};
</script>
<style lang="scss">
.g-page-content {
  padding: 0;
}
.g-page-menu-dropdown i {
  color: #6f727d;
  font-size: 1.5rem;
  top: 50%;
  left: 50%;
}

.g-page-menu-dropdown {
  padding: 0 !important;
  height: 3.1em !important;
  width: 3.1em !important;
  box-shadow: 0px 3px 20px 0px rgba(113, 106, 202, 0.17) !important;
}

.g-page-menu-arrow {
  display: inline-block;
  font-family: "Metronic";
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
  right: 7px;
  padding-top: 4px;
  animation: none;
}

.g-page-menu-arrow:before {
  content: "\f1b1";
  width: 100%;
  height: 100%;
  font-size: 45px;
  color: white;
}

.g-pop-over-menu {
  background: transparent;
  border: none;
  box-shadow: none;
  max-width: 100vw !important;
}

.g-page-wapper {
  -webkit-box-flex: 1;
  flex: 1 auto;
  -ms-flex: 1 0 0px;
  min-width: 0;
}
.g-page-subheader {
  padding: 30px 30px 0 30px;
}
.g-container-aling {
  -webkit-box-align: center !important;
  -ms-flex-align: center !important;
  align-items: center !important;
  display: flex !important;
}
.g-mr-auto {
  margin-right: auto !important;
}
.g-page-title {
  border-right: 1px solid #e2e5ec;
  display: inline-block;
  padding: 7px 25px 7px 0;
  font-family: Roboto;
  font-weight: 300;
  font-size: 1.55rem;
  font-weight: 500;
  vertical-align: middle;
  margin: 0 15px 0 0;
  color: #3f4047;
}
.g-breadcrumb-container {
  display: inline-block;
  width: auto;
  height: 100%;
}

@media (max-width: 768px) {
  .g-page-subheader {
    padding: 0px 30px 0 30px;
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
  }
}
</style>
