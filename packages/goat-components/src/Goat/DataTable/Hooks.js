import stampit from '@stamp/it';

const Hooks = stampit({
  properties: {
    hooks: {},
    trigger: '',
    context: {}
  },
  init({ hooks, trigger, context }) {
    this.hooks = hooks || this.hooks;
    this.trigger = trigger || this.trigger;
    this.context = context || this.context;
  },
  methods: {
    process() {
      const shouldProcess = this.hooks && this.hooks[this.trigger];
      if (!shouldProcess) {
        return { ...this.context };
      }
      return { ...this.context, ...this.hooks[this.trigger](this.context) };
    }
  }
});
export { Hooks as default };
