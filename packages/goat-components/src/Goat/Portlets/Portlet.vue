<template>
  <q-card :class="getClass">
    <q-card-title :class="getClassWithBorder('g-portlet-head')" v-if="hasHeader">
      <div class="g-portlet-head-label">
        <h3 class="g-portlet-head-title">
          <slot name="head"></slot>
        </h3>
      </div>
    </q-card-title>
    <q-card-main class="g-portlet-body">
      <slot></slot>
    </q-card-main>

    <q-card-main :class="getClassWithBorder('g-portlet-foot')" v-if="hasFooter">
      <slot name="foot"></slot>
    </q-card-main>
  </q-card>
</template>

<script>
export default {
  name: 'gPortlet',
  props: ['color', 'noBorder'],
  computed: {
    getClass() {
      return `g-portlet ${this.getColor} ${this.getBorder}`;
    },
    getColor() {
      return this.color ? this.color : '';
    },
    getBorder() {
      return this.noBorder ? 'g-no-border' : '';
    },
    hasHeader() {
      return !!this.$slots.head;
    },
    hasFooter() {
      return !!this.$slots.foot;
    }
  },
  methods: {
    getClassWithBorder(classes) {
      return `${classes} ${this.hasBorder}`;
    }
  }
};
</script>
