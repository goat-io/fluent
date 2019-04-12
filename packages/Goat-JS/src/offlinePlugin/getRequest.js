import Form from 'models/Form';

const GetRequest = class {
  /**
   *
   * @param {*} args
   */
  static async handle (args) {
    // If we are making a request to a external API (NOT FORM.io)
    if (args.url.indexOf('form.io') === -1) {
      return GetRequest.handleExternalAPI(args);
    }
    // If we are trying to get a form we load it locally
    // This action will get triggered when we load a create form
    // of a resource from inside of another Form
    if (args.type === 'form') {
      return GetRequest.handleLocalForm(args);
    }
    // Calling to an internal Form.io route from Select component
    if (args.type === 'select' && args.url.indexOf('form.io') !== -1) {
      return GetRequest.handleInternalResource(args);
    }
  }
  /**
   *
   */
  static handleExternalAPI () {
    // TODO
    return null;
  }
  /**
   *
   * @param {*} args
   */
  static async handleLocalForm (args) {
    return await Form.local()
      .where('data.path', '=', args.formio.formId)
      .first();
  }
  /**
   *
   * @param {*} args
   */
  static async handleInternalResource (args) {
    return null;
    let formID = args && args.url && args.url.split('/')[4];
    let form = await Form.local().find();

    form = form.filter((f) => {
      return f.data._id === formID;
    })[0];

    if (!form) {
      return;
    }
    /* let submissions = await Submission.local().find();

    submissions = submissions.filter((s) => {
      return s.data.formio.formId === form.data.path && s.data.owner === Auth.user()._id;
    });

    submissions = submissions.map((s) => {
      return { data: s.data.data };
    });

    // return submissions;
    */
  }
};

export default GetRequest;
