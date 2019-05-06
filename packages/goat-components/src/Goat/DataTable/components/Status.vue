<template>
  <q-td slot="body-cell-status" slot-scope="scope">
    <div v-if="scope.row.status === 'offline' && scope.row.draft">
      <q-icon name="description" color="grey" size="20px" />
      <q-tooltip>{{ $t('Draft') }}</q-tooltip>
    </div>
    <div v-else-if="scope.row.status === 'offline'">
      <q-icon name="description" color="blue" size="20px" />
      <q-tooltip>{{ $t('Offline submission') }}</q-tooltip>
    </div>
    <div v-else-if="isOnlineSubmission(scope.row._id, scope.row._lid)">
      <q-icon name="cloud_done" color="green" size="20px" />
      <q-tooltip>{{ $t('Online Submission') }}</q-tooltip>
    </div>
    <div v-else>
      <q-icon name="cloud_download" color="green" size="20px" />
      <q-tooltip>{{ $t('Synced Submission') }}</q-tooltip>
    </div>
    <i
      class="material-icons"
      style="color: red;font-size: x-large; cursor: pointer;"
      v-if="scope.row.syncError && scope.row.syncError !== 'Unauthorized'"
      @click="displayError(scope.row.syncError)"
    >
      block
    </i>
    <i
      class="material-icons"
      style="color: red;font-size: x-large; cursor: pointer;"
      v-if="scope.row.syncError && scope.row.syncError === 'Unauthorized'"
      @click="displayError(scope.row.syncError)"
    >
      block
    </i>
  </q-td>
</template>

<script lang="ts">
export default {
  name: 'gTableRowStatus',
  props: ['scope']
};
</script>
