<template>
  <q-btn color="brand" flat @click="openExportModal()" v-if="args">
    <q-icon name="import_export" />
    <q-tooltip>{{ $t('Import and export') }}</q-tooltip>
  </q-btn>
</template>

<script>
export default {
  name: 'gTableImportAction',
  props: ['args']
};
</script>
