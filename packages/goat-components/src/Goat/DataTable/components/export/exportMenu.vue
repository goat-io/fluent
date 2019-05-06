<template>
  <div style="color:black">
    <sweet-modal ref="optionsModal" title="Export">
      <sweet-modal-tab title="Data" id="tab1">
        <p class="caption">Choose your export format</p>
        <q-field icon="fa-file-excel-o" label="Common formats" helper="Pick one export format">
          <q-option-group
            type="radio"
            color="primary"
            v-model="exportFormat"
            :options="[
              { label: 'xlsx  &nbsp| Excel 2007+ XML Format', value: 'xlsx' },
              { label: 'json   &nbsp| Javascript Object Notation', value: 'json' },
              { label: 'csv   &nbsp| Comma Separated Values', value: 'csv' }
            ]"
          />
        </q-field>
        <q-list>
          <q-collapsible icon="fa-files-o" label="More formats..." no-border>
            <div>
              <q-field
                icon="fa-files-o"
                helper="Pick one export format"
                label="Other export formats"
              >
                <q-option-group
                  type="radio"
                  color="primary"
                  v-model="exportFormat"
                  :options="[
                    { label: 'xlsm  | Excel 2007+ Macro XML Format', value: 'xlsm' },
                    { label: 'xlsb  &nbsp| 	Excel 2007+ Binary Format', value: 'xlsb' },
                    { label: 'biff8 | Excel 97-2004 Workbook Format', value: 'biff8' },
                    { label: 'biff5 | Excel 5.0/95 Workbook Format', value: 'biff5' },
                    { label: 'biff2 | Excel 2.0 Worksheet Format', value: 'biff2' },
                    { label: 'xlml  | Excel 2003-2004', value: 'xlml' },
                    { label: 'ods   &nbsp| OpenDocument Spreadsheet', value: 'ods' },
                    { label: 'fods  | Flat OpenDocument Spreadsheet', value: 'fods' },
                    { label: 'txt   &nbsp | UTF-16 Unicode Text (TXT)', value: 'txt' },
                    { label: 'sylk  | Symbolic Link (SYLK)', value: 'sylk' },
                    { label: 'html  | HTML Document', value: 'html' },
                    { label: 'dif   &nbsp | Data Interchange Format (DIF)', value: 'dif' },
                    { label: 'dbf   &nbsp| dBASE II + VFP Extensions (DBF)', value: 'dbf' },
                    { label: 'rtf   &nbsp &nbsp| Rich Text Format (RTF)', value: 'rtf' },
                    { label: 'prn   &nbsp| Lotus Formatted Text', value: 'prn' },
                    { label: 'eth  &nbsp| Ethercalc Record Format (ETH)', value: 'eth' }
                  ]"
                />
              </q-field>
            </div>
          </q-collapsible>
        </q-list>
        <p class="caption">Customize your export</p>
        <q-field
          icon="fa-cogs"
          helper="Select which fields you want to include in the export"
          label="Options"
        >
          <q-option-group
            type="toggle"
            color="primary"
            v-model="exportOptions"
            :options="[{ label: 'Include Owner Email', value: 'ownerEmail' }]"
          />
        </q-field>
      </sweet-modal-tab>
      <sweet-modal-tab title="Form" id="tab2">
        <p class="caption">Choose your export format</p>
        <q-field icon="fa fa-file-excel" class="form-align" label="Excel form">
          <q-option-group
            type="radio"
            color="primary"
            v-model="exportFormat"
            :options="[{ label: 'xlsx  &nbsp| Excel 2007+ XML Format', value: 'xlsx-form' }]"
          />
        </q-field>
        <q-field icon="fa fa-file-pdf" class="form-align" label="PDF form">
          <q-option-group
            type="radio"
            color="primary"
            v-model="exportFormat"
            :options="[{ label: 'pdf  &nbsp| Portable Document Format File', value: 'pdf-form' }]"
          />
        </q-field>
      </sweet-modal-tab>
      <q-btn small slot="button" @click="closeMenu()">Cancel</q-btn>
      <q-btn small slot="button" color="primary" @click="exportSelection()">Export</q-btn>
    </sweet-modal>
  </div>
</template>
<style>
.form-align > i.q-icon.q-field-icon,
.form-align > .row.col {
  display: table-cell;
  vertical-align: middle;
}
.form-align {
  text-align: center;
  display: table !important;
  margin: 0 !important;
  width: 100%;
}
</style>

<script>
import { SweetModal, SweetModalTab } from 'sweet-modal-vue';
import { Event } from '@goatlab/goatjs';

export default {
  components: {
    SweetModal,
    SweetModalTab
  },
  name: 'export-menu',
  props: {
    render: {
      required: true
    },
    actions: {
      required: true
    }
  },
  watch: {
    actions() {},
    render() {}
  },
  data() {
    return {
      exportFormat: undefined,
      exportOptions: []
    };
  },
  methods: {
    emitEvent(event, params) {
      this.$eventHub.emit(event, params);
    },
    exportSelection() {
      Event.emit({
        name: 'FAST:EXPORT',
        data: {
          format: this.exportFormat,
          options: this.exportOptions
        },
        text: 'Exporting'
      });
      /* this.emitEvent('FAST:EXPORT', {
        format: this.exportFormat,
        options: this.exportOptions
      }); */
      this.closeMenu();
      this.exportFormat = undefined;
      this.exportOptions = [];
    },
    openMenu() {
      this.$refs.optionsModal.open('tab1');
    },
    closeMenu() {
      this.$refs.optionsModal.close();
    }
  },
  mounted() {
    Event.listen({
      name: 'FAST:EXPORT:OPENMENU',
      callback: this.openMenu
    });
  },
  beforeDestroy() {
    Event.remove({
      name: 'FAST:EXPORT:OPENMENU',
      callback: this.openMenu
    });
  }
};
</script>
