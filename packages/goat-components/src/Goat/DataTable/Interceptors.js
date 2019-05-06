import stampit from '@stamp/it';

const Interceptors = stampit({
  properties: {
    interceptors: {},
    trigger: '',
    context: {}
  },
  init({ interceptors, trigger, context }) {
    this.interceptors = interceptors || this.interceptors;
    this.trigger = trigger || this.trigger;
    this.context = context || this.context;
  },
  methods: {
    process() {
      if (!this.shouldProcess()) {
        return false;
      }
      return this.interceptors[this.trigger](this.context);
    },
    shouldProcess() {
      const shouldProcess = this.interceptors && this.interceptors[this.trigger];
      if (!shouldProcess) {
        return false;
      }
      return true;
    }
  }
});
export { Interceptors as default };
