<template>
  <q-btn rounded flat class="g-button-pill" no-caps>
    {{ this.transformedText }}
  </q-btn>
</template>

<script>
export default {
  name: 'gPillBtn',
  props: ['color', 'label', 'transform'],
  computed: {
    transformedText() {
      if (!this.transform) {
        return this.label;
      }
      let result = this.label;
      if (this.transform.includes('upper')) {
        result = result.toUpperCase();
      }
      return result;
    }
  }
};
</script>
<style lang="scss" scoped>
.g-button-pill {
  color: #5867dd;
  background: white;
  border: 1px solid transparent;
  border-color: #ebedf2;
  font-weight: 500;
  font-size: 1rem;
}

.g-button-pill:hover {
  border-color: #ebedf2;
  background-color: #f4f5f8;
}
.g-button-pill:focus {
  outline: none;
}
</style>
