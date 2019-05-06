import moment from "moment";
import { Submission } from "@goatlab/goatjs";

const createSubmission = (() => {
  const withData = async ({ email, appUrl, path, parent, data, _id }) => {
    if (_id) {
      const r = {
        name: "formio_submission_update",
        params: {
          idForm: path,
          idSubmission: _id
        },
        query: {
          parent
          // scouting: btoa(JSON.stringify(data))
        }
      };
      return r;
    }
    const date = moment().unix();
    const formSubmission = {
      data,
      draft: true,
      sync: false,
      trigger: "createLocalDraft",
      user_email: email,
      path,
      baseUrl: appUrl,
      created: date,
      modified: date
    };

    const submission = await Submission()
      .local()
      .insert(formSubmission);

    const route = {
      name: "formio_submission_update",
      params: {
        idForm: path,
        idSubmission: submission._id
      },
      query: {
        parent
      }
    };
    return route;
  };
  return Object.freeze({
    withData
  });
})();

export default createSubmission;
