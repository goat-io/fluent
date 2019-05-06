<template>
  <q-btn :class="getClass">
    {{ this.transformedText }}
  </q-btn>
</template>

<script>
export default {
  name: 'gBtn',
  props: ['color', 'text', 'transform'],
  computed: {
    getClass() {
      return `g-button ${this.color}`;
    },
    transformedText() {
      if (!this.transform) {
        return this.text;
      }
      let result = this.text;
      if (this.transform.includes('upper')) {
        result = result.toUpperCase();
      }
      return result;
    }
  }
};
</script>
