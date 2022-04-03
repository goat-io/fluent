import stampit from '@stamp/it'

export default stampit({
  methods: {
    user() {
      throw new Error('user() method not implemented in this connector')
    },
    email() {
      throw new Error('email() method not implemented in this connector')
    },
    hasRoleIn() {
      throw new Error('hasRoleIn() method not implemented in this connector')
    },
    hasRoleIdIn() {
      throw new Error('hasRoleIdIn() method not implemented in this connector')
    },
    hasRole() {
      throw new Error('hasRole() method not implemented in this connector')
    },
    check() {
      throw new Error('check() method not implemented in this connector')
    },
    logOut() {
      throw new Error('logOut() method not implemented in this connector')
    },
    attempt(credentials, baseUrl, role) {
      throw new Error('authenticate() method not implemented in this connector')
    }
  }
})
