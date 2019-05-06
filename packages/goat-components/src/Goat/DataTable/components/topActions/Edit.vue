<template>
  <q-btn color="brand" flat @click="handleEdit()" v-if="args">
    <q-icon name="edit" />
    <q-tooltip>{{ $t(_tooltip) }}</q-tooltip>
  </q-btn>
</template>

<script>
import _get from "lodash/get";
import { Error } from "../../../Alert/Error";
import Interceptors from "../../Interceptors";

export default {
  name: "gTableEditAction",
  props: ["args", "id", "hooks", "interceptors"],
  methods: {
    async handleEdit() {
      const rows = this.$store.state.datatable[this.id].selected;
      if (rows.length > 1) {
        Error.notify({
          title: this.$t("Edit Multiple Rows"),
          text: this.$t("You can't edit more than one row")
        });
        return;
      }

      const submission = rows[0];
      const formId =
        _get(
          this.$store.state.datatable[this.id].form,
          'data.properties["fast-edit-view"]'
        ) || this.$store.state.datatable[this.id].path;

      this.$store.dispatch("resetTable");

      const interceptor = Interceptors({
        interceptors: this.interceptors,
        trigger: "edit",
        context: {
          path: formId,
          id: this.id,
          selected: rows,
          submission: rows.length === 1 ? rows[0] : rows
        }
      });

      if (interceptor.shouldProcess()) {
        await interceptor.process();
        return;
      }

      if (submission.status === "online") {
        this.handleOnlineEdit(submission, formId);
        return;
      }

      this.$router.push({
        name: "formio_submission_update",
        params: {
          path: formId,
          idSubmission: submission._id
        },
        query: {
          parent: this.$route.query.parent
        }
      });
    },
    async handleOnlineEdit(submission, formId) {
      this.$router.push({
        name: "formio_submission_update",
        query: {
          mode: "online",
          parent: this.$route.name
        },
        params: {
          path: this.$route.params.path,
          idForm: formId,
          idSubmission: submission._id
        }
      });
    }
  },
  computed: {
    _label() {
      return (this.args && this.args.label) || "Edit";
    },
    _tooltip() {
      return (this.args && this.args.tooltip) || "Edit";
    }
  }
};
</script>
