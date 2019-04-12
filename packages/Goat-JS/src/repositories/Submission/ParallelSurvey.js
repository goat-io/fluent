import uuidv4 from "uuid/v4";
import Utilities from "utilities";
import Submission from "models/Submission";
import Promise from "bluebird";

let ParallelSurvey = (() => {
  function getNewGroupWizard(vm) {
    let progressSteps = ["1", "2", "3"];
    let steps = [
      {
        title: vm.$t("Group Name"),
        text: vm.$t("Give the group a name"),
        inputValidator: value => {
          return new Promise((resolve, reject) => {
            if (value !== "") {
              resolve();
            } else {
              let error = new Error(vm.$t("The group name is already taken"));

              reject(error);
            }
          });
        }
      },
      {
        title: vm.$t("Current Participant Name"),
        text: vm.$t("Give the current participant a name")
      },
      {
        title: vm.$t("Next participant Name"),
        text: vm.$t("Give the next participant a name")
      }
    ];

    return { progressSteps: progressSteps, steps: steps };
  }

  function getNewUserWizard(vm) {
    let progressSteps = ["1"];
    let steps = [
      {
        title: vm.$t("Participant Name"),
        text: vm.$t("Give the next participant a name")
      }
    ];

    return { progressSteps: progressSteps, steps: steps };
  }

  function getGroupId(submission) {
    let groupId = Utilities.get(
      () => Submission().getParallelSurvey(submission).groupId
    );

    return groupId;
  }

  function submissionHasGroup(groupId) {
    return !!groupId;
  }
  /**
   * Creates the Wizard object to have new user or new group
   * @param {*} param0
   */
  async function createWizard({ submission, vm }) {
    let groupId = getGroupId(submission);

    if (submissionHasGroup(groupId)) {
      return Object.assign({}, getNewUserWizard(vm), { groupId: groupId });
    }
    return Object.assign({}, getNewGroupWizard(vm), { groupId: groupId });
  }
  function prepareNewGroupObject({ submission, vm, info }) {
    let groupName = info[0];
    let participantName = info[1];
    let nextParticipant = info[2];
    // Format the parallelSurvey object
    let parallelSurvey = {
      groupId: uuidv4(),
      groupName: groupName,
      participantName: participantName,
      submissionId: submission._id
    };

    // Store information of the parallelSurvey on the current submission
    vm.currentSubmission.parallelSurvey = Submission().setParallelSurvey(
      parallelSurvey
    );

    // New survey Information
    let surveyData = {
      parallelSurvey: Submission().setParallelSurvey({
        ...parallelSurvey,
        participantName: nextParticipant
      })
    };

    return surveyData;
  }

  function prepareNewUserObject({ submission, info }) {
    let participantName = info[0];
    let parallelsurveyInfo = Submission().getParallelSurvey(submission);

    parallelsurveyInfo.participantName = participantName;
    // New survey Information
    let surveyData = {
      parallelSurvey: Submission().setParallelSurvey(parallelsurveyInfo)
    };

    return surveyData;
  }

  async function createNewSurvey({ submission, vm, info }) {
    let groupId = getGroupId(submission);

    if (submissionHasGroup(groupId)) {
      return prepareNewUserObject({ submission, vm, info });
    }
    return prepareNewGroupObject({ submission, vm, info });
  }

  async function assignSelfId(created) {
    console.log(created);
  }

  return Object.freeze({
    createWizard,
    createNewSurvey,
    assignSelfId
  });
})();

export default ParallelSurvey;
