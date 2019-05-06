<template>
  <q-btn flat color="grey" @click="handleDelete()" v-if="args">
    <q-icon name="delete" />
    <q-tooltip>{{ $t('Delete') }}</q-tooltip>
  </q-btn>
</template>

<script>
import { Form, Submission } from '@goatlab/goatjs';
import Promise from 'bluebird';
import Error from '../../../Alert/Error';
import Success from '../../../Alert/Success';
import Question from '../../../Alert/Question';

export default {
  name: 'gTableDeleteAction',
  props: ['args', 'id'],
  methods: {
    handleDelete() {
      const rows = this.$store.state.datatable[this.id].selected;
      if (rows.length === 0) {
        Error.notify({
          title: this.$t('No row selected'),
          text: this.$t('You must select at least one row to delete')
        });
        return;
      }

      Question.confirm({
        title: this.$t('Are you sure?'),
        text: this.$t("You won't be able to revert this!"),
        confirmText: this.$t('Yes, delete it!'),
        cancelText: this.$t('Cancel'),
        onConfirm: async () => {
          Promise.each(rows, async submission => {
            if (submission._id && !submission._id.includes('_local')) {
              await Form.getModel({ path: this.id })
                .remote()
                .remove(submission._id);
            } else {
              await Submission.local().remove(submission._id);
            }
          })
            .then(async () => {
              this.$emit('refresh');
              Success.notify({
                title: this.$t('Deleted!'),
                text: this.$t('Your submission has been deleted.')
              });
              this.selected = [];
            })
            .catch(error => {
              // eslint-disable-next-line
              console.log(error);
              this.$swal(this.$t('Error!'), this.$t("Can't delete online submission."), 'error');
            });
        }
      });
    }
  }
};
</script>
