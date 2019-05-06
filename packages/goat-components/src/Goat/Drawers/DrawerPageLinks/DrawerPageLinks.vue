<template>
  <div>
    <g-drawer-link
      :label="$t(page.title)"
      :icon="page.icon"
      :to="to(page)"
      v-for="page in visiblePages"
      :key="page.url"
    />
  </div>
</template>

<script>
import { Auth, Submission } from '@goatlab/goatjs';
import { mapActions } from 'vuex';
import gDrawerLink from '../Link';

export default {
  name: 'gDrawerPageLinks',
  components: {
    gDrawerLink
  },
  async created() {
    await this.setPages();
  },
  computed: {
    visiblePages() {
      return this.$store.state.pages.visible;
    }
  },
  methods: {
    ...mapActions(['setPages']),
    to(page) {
      let to = { name: 'pageManager', params: { path: page.url } };

      if (page.internal) to = { name: page.internalUrl };
      if (page.internalUrl === 'classifier') to = this.goToClassifier();
      if (page.internalUrl === 'CollectedData') to = this.goToCollectedData();
      if (page.internalUrl === 'newSurvey') to = this.goToFormSubmission();
      if (page.internalUrl === 'userDashboard') to = this.goToUserDashboard();
      return to;
    },
    icon(pageIcon) {
      const iconName = pageIcon.split('-');
      if (iconName[0] === 'fa') return `fa ${pageIcon}`;
      return pageIcon;
    },
    // TODO: transform this into a helper
    async goToFormSubmission() {
      const formSubmission = {
        data: {},
        draft: true,
        sync: false,
        trigger: 'createLocalDraft',
        user_email: Auth()
          .connector()
          .email(),
        path: 'scoutingtraps',
        baseUrl: this.$FAST_CONFIG.APP_URL,
        created: new Date(),
        modified: new Date()
      };
      const submission = await Submission({ path: 'Scoutingtraps' })
        .local()
        .insert(formSubmission);
      const route = {
        name: 'formio_submission_update',
        params: {
          path: 'scoutingtraps',
          idSubmission: submission._id
        },
        query: {
          parent: this.$route.query.parent
        }
      };
      return route;
    },
    goToCollectedData() {
      const route = {
        name: 'formio_form_show',
        params: {
          path: 'scoutingtraps'
        }
      };
      return route;
    },
    goToClassifier() {
      return { name: 'formio_form_show_classifier' };
    },
    goToUserDashboard() {
      const route = {
        name: 'user_dashboard_show',
        params: {
          path: 'user/dashboard',
          name: 'User Dashboard'
        }
      };
      return route;
    }
  }
};
</script>
