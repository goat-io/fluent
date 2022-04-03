import stampit from '@stamp/it'

export default stampit({
  methods: {
    subscribe() {
      throw new Error('subscribe() method not implemented in this connector.')
    },
    bind() {
      throw new Error('bind() method not implemented in this connector.')
    },
    trigger() {
      throw new Error('trigger() method not implemented in this connector.')
    }
  }
})
