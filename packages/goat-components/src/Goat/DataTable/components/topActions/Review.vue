<template>
  <q-btn color="brand" flat @click="handleReview({ readOnly: false })" v-if="args">
    <q-icon name="remove_red_eye" />
    <q-tooltip>{{ $t('Review') }}</q-tooltip>
  </q-btn>
</template>

<script>
export default {
  name: 'gTableReviewAction',
  props: ['args'],
  methods: {
    async handleReview({ readOnly }) {
      const rows = this.$store.state.datatable[this.path].selected;
      if (rows.length > 1) {
        Error.notify({
          title: this.$t('Review for multiple rows'),
          text: this.$t("You can't review more than one row")
        });
        return;
      }
      const submission = rows[0];
      const { path } = this.$store.state.datatable[this.path];
      this.$router.push({
        name: 'formio_submission_update',
        query: {
          mode: readOnly ? 'read-only' : 'online-review',
          parent: this.$route.name
        },
        params: {
          path: this.$route.params.path,
          idSubmission: submission._id,
          idForm: path
        }
      });
    }
  }
};
</script>
