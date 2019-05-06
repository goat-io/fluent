<template>
  <div class="g-header-logo-container">
    <img class="g-header-logo" :src="src" :alt="alt" />
  </div>
</template>

<script>
export default {
  name: 'gHeaderLogo',
  props: ['alt', 'src'],
  watch: {
    src() {},
    alt() {}
  }
};
</script>
