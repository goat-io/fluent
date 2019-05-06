<template>
  <q-btn
    color="brand"
    flat
    @click="handleCreate()"
    class="g-table-action-create"
    v-if="args"
  >
    <q-icon name="fas fa-plus" class="g-table-create-icon" />
    <span class="g-table-action-label">{{ $t(_label) }} </span>
    <q-tooltip>{{ $t(_tooltip) }}</q-tooltip>
  </q-btn>
</template>

<script>
import { Submission, Auth } from "@goatlab/goatjs";
import createSubmission from "../../../createSubmission";
// import Hooks from '../../Hooks';
// import Interceptors from '../../Interceptors';

export default {
  name: "gTableCreateAction",
  props: ["args"],
  methods: {
    async handleCreate() {
      const classifierData = await Submission({ path: "classification" })
        .remote()
        .where(
          "owner",
          "=",
          Auth()
            .connector()
            .user()._id
        )
        .andWhere(
          "data.jobPostingId",
          "=",
          this.$store.state.datatable[this.path].selected[0]._id
        )
        .limit(1)
        .first();

      const result = await createSubmission.withData({
        _id:
          classifierData && classifierData.data
            ? classifierData._id
            : undefined,
        email: Auth()
          .connector()
          .email(),
        appUrl: this.$FAST_CONFIG.APP_URL,
        path: "classification",
        parent: this.$route.query.parent,
        data: classifierData && classifierData.data ? classifierData.data : {}
      });

      const route = {
        name: "formio_classifier",
        params: {
          path: "classification",
          idSubmission: result.params.idSubmission
        },
        query: {
          type: "classifier",
          jobId: this.$store.state.datatable[this.path].selected[0]._id
        }
      };

      this.$router.push(route);
    }
  },
  computed: {
    _label() {
      return (this.args && this.args.label) || "Create";
    },
    _tooltip() {
      return (this.args && this.args.tooltip) || "Create";
    }
  }
};
</script>
<style lang="scss">
.g-table-action-create {
  background-color: #5d78ff;
  border-color: #5d78ff;
  color: white;
  position: absolute;
  right: 30px;
  top: 15px;
  .q-icon {
    font-size: 1.1em;
  }
}
.g-table-action-label {
  padding-left: 0.5em;
  font-size: 1rem;
  font-weight: 400;
  font-family: Poppins;
  text-transform: none;
}
.g-table-create-icon {
  padding-right: 0.5rem;
  vertical-align: middle;
  line-height: 0;
}
</style>
