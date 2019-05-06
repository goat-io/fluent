<template>
  <q-breadcrumbs-el>
    <i :class="getClass"></i>
    <span class="g-breadcrumb-label"> {{ label }} </span>
  </q-breadcrumbs-el>
</template>

<script>
export default {
  name: 'gBreadcrumbEl',
  props: ['label', 'icon'],
  computed: {
    getClass() {
      return `g-breadcrumb-icon ${this.icon}`;
    }
  }
};
</script>
<style lang="scss" scoped>
.g-breadcrumb-icon {
  font-size: 1.3rem;
  color: #898b96;
  padding-right: 10px;
}
.g-breadcrumb-label {
  color: #898b96;
  font-weight: 400;
  padding-right: 15px;
}
</style>
