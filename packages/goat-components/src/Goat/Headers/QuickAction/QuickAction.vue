<template>
  <q-btn inverted flat no-caps dense class="g-header-menu g-header-menu-button">
    <i :class="getClass" v-if="!picture"></i>

    <span class="picture-icon-container">
      <img v-if="picture" :src="picture" class="g-quick-action-image-rounded picture-icon" alt="" />
    </span>

    <div>{{ label }}</div>
    <q-chip floating class="floating-chip" v-if="chip">{{ chip }}</q-chip>
    <q-popover class="g-pop-over-action-header">
      <span class="g-header-menu-arrow g-quick-action"></span>

      <q-list link class="g-menu-popover-quick-action">
        <div :class="getHeaderClass">
          <div class="g-quick-action-card-user" v-if="picture">
            <div class="g-quick-action-card-user-picture">
              <img :src="picture" class="g-quick-action-image-rounded" alt="" />
            </div>
            <div class="g-quick-action-card-user-detail">
              <div class="g-quick-action-user-title">{{ title }}</div>
              <div class="g-quick-action-user-subtitle">{{ subtitle }}</div>
            </div>
          </div>
          <div class="g-quick-action-header-title" v-if="!picture">{{ title }}</div>
          <div class="g-quick-action-header-subtitle" v-if="!picture">{{ subtitle }}</div>
        </div>
        <div class="g-quick-action-body">
          <slot></slot>
        </div>
        <div class="g-quick-action-footer"><slot name="footer"></slot></div>
      </q-list>
    </q-popover>
  </q-btn>
</template>
<script>
export default {
  name: 'gHeaderQuickAction',
  props: ['label', 'icon', 'chip', 'title', 'subtitle', 'picture'],
  watch: {
    label() {},
    icon() {},
    chip() {},
    title() {},
    subtitle() {},
    picture() {}
  },
  computed: {
    getClass() {
      return `q-icon on-left quick-action-icon ${this.icon}`;
    },
    getHeaderClass() {
      if (this.picture) {
        return 'g-quick-action-header-picture';
      }
      return 'g-quick-action-header';
    }
  }
};
</script>
<style lang="scss">
.g-quick-action-footer {
  padding-left: 40px;
  max-width: 99.7vw !important;
}
.g-header-menu {
  height: 100%;
  vertical-align: middle;
  outline: none !important;
  .picture-icon-container {
    display: table-cell;
    vertical-align: middle;
    text-align: center;
    margin: 0 auto;
  }

  .picture-icon {
    display: block;
    max-width: 34px !important;
  }

  .floating-chip {
    position: inherit;
    border-radius: 2rem;
    background-color: #716aca;
    color: white;
    font-size: 0.8rem;
    padding: 1px 10px;
  }

  .q-btn-inner {
    font-weight: 500;
    font-size: 1.07rem;
    text-transform: initial;
    color: #676c7b;
  }
  .q-icon {
    color: #b8bece;
    font-size: 1.4rem;
    width: 30px;
    text-align: left;
    padding: 0;
    line-height: 0;
  }

  .quick-action-icon {
    color: #ad5beb;
    font-size: 1.5rem;
    width: 35px;
    font-style: italic;
  }

  .quick-action-icon:before {
    font-weight: bold;
    padding: 1px;
    background: linear-gradient(180deg, #ad5beb 25%, #c678db 50%, #da6ea9 75%, #e76e92 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.g-header-menu:hover,
.g-header-menu:active {
  height: 100%;
  vertical-align: middle;
  .q-btn-inner {
    color: #716aca;
  }
  .q-icon {
    color: #716aca;
  }
}
.g-menu-popover-quick-action {
  width: 450px;
  box-shadow: 0px 0px 15px 1px rgba(69, 65, 78, 0.2);
  padding: 0px 0px 20px 0px;
  border-radius: 4px;
  background-color: #fff;
  margin-top: 12px;
  animation: none;
  max-width: 100vw !important;
}

.g-header-menu-arrow.g-quick-action {
  display: inline-block;
  font-family: 'Metronic';
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
  left: auto;
  right: 10px;
  padding-top: 4px;
  animation: none;
}

.g-header-menu-arrow.g-quick-action:before {
  content: '\f1b1';
  width: 100%;
  height: 100%;
  font-size: 45px;
  color: #354ab2;
}
.g-pop-over-action-header {
  background: transparent;
  border: none;
  box-shadow: none;
  max-width: 100vw !important;
  margin-top: 22px;
}

.g-quick-action-header-picture {
  width: 450px;
  height: 120px;
  background: url(https://keenthemes.com/metronic/preview/default/assets/media/misc/bg-1.jpg);
  background-size: cover;
  width: 449px;
  padding: 20px 20px;
  border-radius: 4px 4px 0 0;
  max-width: 99.7vw !important;
}

.g-quick-action-header {
  width: 450px;
  height: 94px;
  // background: #7e55dd;
  background: url(https://keenthemes.com/metronic/preview/default/assets/media/misc/bg-1.jpg);
  background-size: cover;
  width: 449px;
  padding: 20px 20px;
  border-radius: 4px 4px 0 0;
  max-width: 99.7vw !important;
}
.g-quick-action-header-title {
  display: block;
  padding: 0 0 5px 0;
  font-size: 1.4rem;
  font-weight: 400;
  color: white;
  text-align: center;
  font-family: Poppins;
  line-height: 1.5;
}

.g-quick-action-header-subtitle {
  display: block;
  padding: 0 0 5px 0;
  color: white;
  text-align: center;
  line-height: 1.5;
  display: block;
  padding: 0px;
  font-size: 1rem;
  font-weight: 300;
}

.g-quick-action-card-user {
  padding: 5px 0;
  margin: 0;
  display: table;
  table-layout: fixed;
}

.g-quick-action-card-user-picture {
  display: table-cell;
  text-align: right;
  padding: 0 5px 0 0;
  vertical-align: middle;
  width: 70px;
}

.g-quick-action-image-rounded {
  max-width: 70px !important;
  margin: 0 !important;
  border-radius: 100%;
}
.g-quick-action-card-user-detail {
  display: table-cell;
  width: 100%;
  text-align: left;
  vertical-align: middle;
  padding: 0 0 0 15px;
}

.g-quick-action-user-title {
  display: block;
  padding: 0 0 0 0;
  font-size: 1.3rem;
  font-weight: 400;
  color: #d9dae3;
  font-family: Poppins;
  line-height: 1.5;
}

.g-quick-action-user-subtitle {
  display: block;
  padding: 0 0 5px 0;
  color: #aeafc2;
  line-height: 1.5;
  display: block;
  padding: 0px;
  font-size: 1rem;
  font-weight: 300;
}

.g-quick-action-body {
  padding: 20px;
  max-width: 99.7vw !important;
}

@media (max-width: 767px) {
  .g-header-menu-arrow.g-quick-action {
    display: none;
  }
  .g-pop-over-action-header {
    left: inherit !important;
    margin-top: 2px;
  }
}

.g-header-menu-button {
  width: 50px;
}
</style>
