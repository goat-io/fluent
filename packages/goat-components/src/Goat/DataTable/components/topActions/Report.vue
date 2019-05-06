<template>
  <q-btn v-if="args" color="brand" flat @click="handleReport()">
    <q-icon name="assignment" />
    <q-tooltip>{{ $t('Report') }}</q-tooltip>
  </q-btn>
</template>

<script>
export default {
  name: 'gTableReportAction',
  props: ['args'],
  methods: {
    handleReport() {
      const rows = this.selected;

      if (rows.length > 1) {
        this.$swal({
          title: this.$t('Report for multiple rows'),
          text: this.$t("You can't see the report more than one row"),
          type: 'error'
        });
        return;
      }
      const submission = this.selectedRows[0];

      this.$router.push({
        name: 'formio_submission_report',
        params: {
          idForm: this.form.data.path,
          idSubmission: submission._lid || submission._id
        },
        query: {
          parent: this.$route.query.parent
        }
      });
    }
  }
};
</script>

<style scoped>
</style>