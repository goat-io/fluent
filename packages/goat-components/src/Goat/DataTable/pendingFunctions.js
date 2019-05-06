import _get from 'lodash/get';
import _camelCase from 'lodash/camelCase';
import { Import, Submission, Event, Auth, OfflinePlugin } from '@goatlab/goatjs';
import Formio from 'formiojs/Formio';
import ExcelExport from 'fast-component2excel';
import createSubmission from 'components/createSubmission';
import Export from './export/Export';


isOnlineSubmission(_id, _lid) {
    return !_lid && _id.indexOf('_local') < 0;
},
async exportToExcel() {
    this.$swal({
        title: 'Exporting...',
        text: this.$t('Wait until the file is ready. This can take a couple minutes...'),
        showCancelButton: false,
        onOpen: async () => {
            this.$swal.showLoading();

            await ExcelExport.convertJsonToFile(this.form.data);

            this.$swal(
                this.$t('Exported!'),
                `${this.$t('The file has been exported. File name:')}<br><strong></strong>`,
                'success'
            );
        }
    });
},
async exportTo(params) {
    this.$swal({
        title: 'Exporting...',
        text: this.$t('Wait until the file is ready. This can take a couple minutes...'),
        showCancelButton: false,
        onOpen: async () => {
            this.$swal.showLoading();
            let data = [];
            data = this.selectedRows.length === 0 ? this.data : this.selectedRows;
            const submissions = await this.getFullSubmissions(data, params.options);
            const date = new Date()
                .toJSON()
                .replace(/-/g, '')
                .replace(/T/g, '_')
                .replace(/:/g, '')
                .slice(0, 15);

            const fileName = `${_camelCase(this.form.data.title)}_${date}`;

            await Export.jsonTo({
                fileName,
                output: params.format,
                options: params.options,
                data: submissions,
                formioForm: this.form.data,
                vm: this
            });
            this.$swal(
                this.$t('Exported!'),
                `${this.$t('The file has been exported. File name:')}<br><strong>${fileName}</strong>`,
                'success'
            );
        }
    });
},
async handleCreate() {
    const editData = this.classifierData.find(o => o.data.jobPostingId === this.selected[0]._id);
    const result = await createSubmission.withData({
        email: Auth().connector().email(),
        appUrl: this.$FAST_CONFIG.APP_URL,
        path: 'classification',
        parent: this.$route.query.parent,
        data: editData && editData.data ? editData.data : {}
    });

    const route = {
        name: 'formio_classifier',
        params: {
            path: 'classification',
            idSubmission: result.params.idSubmission
        },
        query: {
            type: 'classifier',
            jobId: this.selected[0]._id
        }
    };

    this.$router.push(route);
},
async getFullSubmissions(submissions, options) {
    const query = {
        limit: 50000,
        form: this.form.data.path,
        filter: {
            'data.formio.formId': this.form.data.path,
            'data.user_email': Auth().connector().email()
        },
        dataExport: true
    };

    if (options && options.includes('ownerEmail')) {
        query.populate = ['owner'];
    }
    let sub = await Submission.merged().showView(query);

    // Get all Ids in the selection
    const ids = submissions.reduce((acc, s) => {
        if (s._id) {
            acc.push(s._id);
        }
        return acc;
    }, []);

    // Filter the ids
    sub = sub.filter(s => ids.includes(s._id));
    return sub;
}
openExportModal() {
    Event.emit({
        name: 'FAST:EXPORT:OPENMENU',
        data: {},
        text: 'Triggering Open Export Menu'
    });
},
async handleExport(params) {
    // const rows = this.selected;

    if (params.detail.data.format === 'xlsx-form') {
        await this.exportToExcel(params.detail.data);
    }
},
async importSubmission() {
    const file = await this.$swal({
        title: this.$t('Select your JSON file'),
        input: 'file',
        inputAttributes: {
            accept: '.json',
            'aria-label': this.$t('Upload your JSON File')
        }
    });
    if (file) {
        Import.fromJsonFile(file, this);
    }
},
displayError(error) {
    const errorString = ErrorFormatter.format(error);
    this.$swal({
        title: error.name,
        type: 'info',
        html: errorString,
        showCloseButton: true,
        showCancelButton: false,
        confirmButtonText: 'OK'
    });
},
goToCreateView() {
    const formId = _get(this.form, 'data.properties["fast-create-view"]') || this.form.data.path;
    const url = `${this.$FAST_CONFIG.APP_URL}/${formId}`;

    const formSubmission = {
        data: {},
        redirect: 'Update',
        draft: true,
        trigger: 'createLocalDraft'
    };
    const formio = new Formio(url);

    Formio.deregisterPlugin('offline');
    // Register the plugin for offline mode
    Formio.registerPlugin(
        OfflinePlugin.getPlugin({
            formio
        }),
        'offline'
    );

    formio.saveSubmission(formSubmission).then(created => {
        this.$router.push({
            name: 'formio_submission_update',
            params: {
                idForm: formio.formId,
                idSubmission: created._id
            },
            query: {
                parent: this.$route.query.parent
            }
        });
    });
},
goToEditView() {
    const rows = this.selected;
    if (rows.length > 1) {
        this.$swal({
            title: this.$t('Edit Multiple Rows'),
            text: this.$t("You can't edit more than one row"),
            type: 'error'
        });
        return;
    }
    const submission = this.selected[0];
    const formId = _get(this.form, 'data.properties["fast-edit-view"]') || this.form.data.path;
    if (submission.status === 'online' && !submission._lid) {
        this.handleOnlineEdit(submission, formId);
        return;
    }
    const submissionId = submission._lid || submission._id;
    this.$router.push({
        name: 'formio_submission_update',
        params: {
            path: formId,
            idSubmission: submissionId
        },
        query: {
            parent: this.$route.query.parent
        }
    });
},
async editCell(data) {
    const value = await this.$swal({
        // The title must be replced by a compound ID from FORM.io dg property
        title: data.col.label,
        input: 'text',
        inputPlaceholder: `Enter amount for ${data.col.label}`,
        inputValue: data.data,
        showCancelButton: true
    });

    if (value) {
        this.data[data.row.__index][data.col.field] = value;
        /* this.rerender()
        let autoSave = new CustomEvent("autoSaveDraft", {
          detail: {
            data: {
              trigger: 'editGrid'
            },
            text: "Autosave Requested"
          }
        });
        document.dispatchEvent(autoSave);
        */
    }
}