import { Fluent } from "../fluent";
import Utilities from "../utilities";
import Configuration from "./Configuration";
import dayjs from "dayjs";

export default Fluent.model({
  properties: {
    name: "Pages",
    config: {
      remote: {
        path: "ui-pages",
        token: undefined,
      },
    },
  },
  methods: {
    /**
     * Decides whether to set submissions
     * Online or Offline
     * @param {Object} config.appConfig The application Config
     * @param {Boolean} config.forceOnline If we need online
     */
    async set({ appConf, forceOnline }) {
      if (!forceOnline) {
        return this.setOffline({ appConf });
      }
      return this.setOnline();
    },
    /**
     * Sets all pages from the offline
     * JSON files
     * @param {Object} appConfig Application config
     * @return {Object} App pages
     */
    async setOffline({ appConf }) {
      let localPages = await this.local().first();
      let localDate = this.getUpdatedDate(localPages);
      let config = await Configuration.local().first();
      let offlinePages = Utilities.get(
        () => appConf.offlineFiles.Pages[0].data
      );

      // Check if pages follows new or legacy format
      if (!offlinePages.hasOwnProperty("pages")) {
        const p = [];

        for (let i = 0; i < appConf.offlineFiles.Pages.length; i += 1) {
          p.push(appConf.offlineFiles.Pages[i].data);
        }

        offlinePages = {
          pages: p,
          submit: true,
        };
      }

      // If the configuration in the JSON file is
      // older than the one in the local DB
      if (config.fastUpdated < localDate) {
        return Utilities.get(() => localPages.data);
      }

      if (localPages) {
        await this.local().clear({ sure: true });
      }
      return this.local().insert({
        ...offlinePages,
        fastUpdated: dayjs().unix(),
      });
    },
    /**
     * Sets all pages from the online
     * JSON files
     * @return {Object} App pages
     */
    async setOnline() {
      let localPages = await this.local().first();
      let pages = await this.remote().limit(9999999).get()

      // Check if pages follows new or legacy format
      if (!pages[0].data.hasOwnProperty("pages")) {
        const p = [];

        for (let i = 0; i < pages.length; i += 1) {
          p.push(pages[i].data);
        }

        pages = {
          pages: p,
          submit: true,
        };
      } else {
        pages = Utilities.get(() => pages[0].data);
      }

      // If we pulled the remote pages and
      // The submission is not empty
      if (pages && !Utilities.isEmpty(pages)) {
        if (localPages) {
          await this.local().clear({ sure: true });
        }
        return this.local().insert({ ...pages, fastUpdated: dayjs().unix() });
      }

      return localPages;
    },
    /**
     * Takes the local pages and gets the
     * updated at date
     *
     * @param {Array} pages Array of local pages
     * @returns {number} date las updated
     */
    getUpdatedDate(pages) {
      return Utilities.get(() => pages.fastUpdated, 0);
    },
  },
})();
