const states = {
  drawerOpen: true,
  actionDrawerOpen: false
};

const actions = {
  toggleDrawer({ commit }) {
    commit('toggleDrawer', null);
  },
  toggleActionDrawer({ commit }) {
    commit('toggleActionDrawer', null);
  }
  /*
    addProductToCart({ state, commit }, product) {
      commit('setCheckoutStatus', null);
      if (product.inventory > 0) {
        const cartItem = state.items.find(item => item.id === product.id);
        if (!cartItem) {
          commit('pushProductToCart', { id: product.id });
        } else {
          commit('incrementItemQuantity', cartItem);
        }
        // remove 1 item from stock
        commit('products/decrementProductInventory', { id: product.id }, { root: true });
      }
    }
    */
};

const mutations = {
  toggleDrawer(state) {
    state.drawerOpen = !state.drawerOpen;
  },
  toggleActionDrawer(state) {
    state.actionDrawerOpen = !state.actionDrawerOpen;
  }
};

const layout = {
  state: states,
  mutations,
  actions
};

export default layout;
