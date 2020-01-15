import dayjs from "dayjs";
import Utilities from "utilities";
import { Fluent } from "@goatlab/goat-fluent";
import Labels from "./repositories/Labels";
import Configuration from "./Configuration";

export default Fluent.model({
  properties: {
    name: "Form",
    config: {
      remote: {
        path: "form",
        pullForm: true
      }
    }
  },
  methods: {
    getModel({ path }) {
      return Fluent.model({
        properties: {
          config: {
            remote: { path }
          }
        }
      })();
    },
    get() {
      return this.remote()
        .limit(99999)
        .get();
    },
    find({ _id }) {
      return this.remote()
        .where("_id", "=", _id)
        .first();
    },
    update(form) {
      return this.remote().update(form);
    },
    insert(form) {
      return this.remote().insert(form);
    },
    delete(_id) {
      return this.remote().remove(_id);
    },
    /**
     *
     * @param {*} action
     */
    async cardFormattedForms(action) {
      let result = await this.local().get();
      result = result.filter(o => {
        return o.data.tags.indexOf("visible") > -1;
      });
      result = result.sort((a, b) => {
        a = a.data.title;
        b = b.data.title;
        return a > b ? 1 : a < b ? -1 : 0;
      });

      result = result.map(f => {
        return {
          title: f.data.title,
          tags: f.data.tags,
          customIcon: true,
          icon:
            action === "create"
              ? "statics/customSVG/startSurvey.svg"
              : "statics/customSVG/collectedData.svg",
          subtitle: "Last updated: " + dayjs(f.data.modified).fromNow(),
          actions: [
            {
              text: action === "create" ? "Start" : "View data",
              target: "form",
              view: action,
              path: f.data.path
            }
          ]
        };
      });

      result = { cards: result };
      return result;
    },
    /**
     *
     */
    async FormLabels(i18n) {
      let forms = await this.local().get();

      return Labels.get(forms, i18n);
    },
    /**
     *
     * @param {*} forms
     */
    getUpdatedAt(forms) {
      return Utilities.get(() => forms[0].fastUpdated, 0);
    },
    /**
     *
     * @param {*} param0
     */
    async setOffline({ appConf }) {
      let localForms = await this.local().get();

      let localDate = this.getUpdatedAt(localForms);
      let config = await Configuration.local().first();
      let offlineForms = Utilities.get(() => appConf.offlineFiles.Forms);

      // If the JSON file is newer than the local
      // DB data
      if (config.fastUpdated < localDate) {
        return localForms;
      }

      if (localForms) {
        await this.local().clear({ sure: true });
      }
      const unixDate = dayjs().unix();
      offlineForms.forEach(async form => {
        await this.local().insert({ data: form, fastUpdated: unixDate });
      });
      return offlineForms;
    },
    /**
     *
     */
    async setOnline() {
      let remoteForms = await this.remote()
        .limit(9999999)
        .get();
      let unixDate = dayjs().unix();

      if (remoteForms && !Utilities.isEmpty(remoteForms)) {
        await this.local().clear({ sure: true });
        const forms = remoteForms.reduce((forms, form) => {
          const element = {
            data: form,
            fastUpdated: unixDate
          };
          forms.push(element);
          return forms;
        }, []);
        return await this.local().insert(forms, { showProgress: true });
      }
    },
    /**
     *
     * @param {*} param0
     */
    async set({ appConf, forceOnline }) {
      if (!forceOnline) {
        return this.setOffline({ appConf });
      }
      return this.setOnline();
    },
    async getFastTableTemplates({ path }) {
      let fullForm = await this.local()
        .where("data.path", "=", path)
        .first();

      let templates = [];

      Utilities.eachComponent(fullForm.data.components, c => {
        if (c.properties && c.properties.FAST_TABLE_TEMPLATE) {
          templates.push({
            key: c.key,
            template: c.properties.FAST_TABLE_TEMPLATE
          });
        }
      });

      return templates;
    },
    dataObject(form) {
      return {};
    }
  }
})();
