<template>
  <q-breadcrumbs class="g-breadcrumb">
    <slot></slot>
  </q-breadcrumbs>
</template>
<script>
export default {
  name: 'gBreadcrumb'
};
</script>
<style lang="scss" scoped>
@media (max-width: 768px) {
  .g-breadcrumb {
    margin-top: 0.75rem;
  }
}
</style>
