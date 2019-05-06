import { Auth, Pages, Utilities } from '@goatlab/goatjs';

const states = {
  visible: [],
  all: []
};

const actions = {
  async setPages({ commit }) {
    const getPages = await Pages.local().first();
    let allPages = JSON.parse(JSON.stringify(getPages.pages));

    allPages.map(page => {
      page.cards.map(card => {
        card.actions.map(action => {
          action.shouldDisplay = Auth()
            .connector()
            .hasRoleIn(action.access);
          return { ...action };
        });
        card.shouldDisplay = Auth()
          .connector()
          .hasRoleIn(card.access);
        return { ...card };
      });
      page.shouldDisplay = Auth()
        .connector()
        .hasRoleIn(page.access);
      return { ...page };
    });

    allPages = allPages.sort((a, b) => {
      const A = Utilities.getFromPath(a, 'index', undefined).value;
      const B = Utilities.getFromPath(b, 'index', undefined).value;
      return A > B ? 1 : -1;
    });

    commit('setPages', allPages);
    commit('setVisibleLeftDrawer', allPages);
  }
};

const mutations = {
  setPages(state, pages) {
    state.all = pages;
  },
  setVisibleLeftDrawer(state, pages) {
    state.visible = pages.filter(page => page.SHOW_LD && page.shouldDisplay);
  }
};

const pages = {
  state: states,
  mutations,
  actions
};

export default pages;
