<template>
  <q-layout view="lhh Lpr lff">
    <slot name="drawer"> </slot>
    <slot name="header"> </slot>
    <slot> </slot>
    <q-page-container padding class="g-page-container">
      <router-view />
    </q-page-container>

    <slot name="footer"> </slot>
  </q-layout>
</template>

<script>
export default {
  name: 'gAppLayout'
};
</script>
<style lang="scss">
.g-page-container {
  padding-top: 10px !important;
}
</style>
