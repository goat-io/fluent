import { Id } from '../../../Helpers/Id'
import Submission from '../../models/Submission'
import Utilities from '../../utilities'

const ParallelSurvey = (() => {
  function getNewGroupWizard(vm) {
    const progressSteps = ['1', '2', '3']
    const steps = [
      {
        title: vm.$t('Group Name'),
        text: vm.$t('Give the group a name'),
        inputValidator: value => {
          return new Promise((resolve, reject) => {
            if (value !== '') {
              resolve()
            } else {
              const error = new Error(vm.$t('The group name is already taken'))

              reject(error)
            }
          })
        }
      },
      {
        title: vm.$t('Current Participant Name'),
        text: vm.$t('Give the current participant a name')
      },
      {
        title: vm.$t('Next participant Name'),
        text: vm.$t('Give the next participant a name')
      }
    ]

    return { progressSteps: progressSteps, steps: steps }
  }

  function getNewUserWizard(vm) {
    const progressSteps = ['1']
    const steps = [
      {
        title: vm.$t('Participant Name'),
        text: vm.$t('Give the next participant a name')
      }
    ]

    return { progressSteps: progressSteps, steps: steps }
  }

  function getGroupId(submission) {
    const groupId = Utilities.get(
      () => Submission().getParallelSurvey(submission).groupId
    )

    return groupId
  }

  function submissionHasGroup(groupId) {
    return !!groupId
  }
  /**
   * Creates the Wizard object to have new user or new group
   * @param {*} param0
   */
  async function createWizard({ submission, vm }) {
    const groupId = getGroupId(submission)

    if (submissionHasGroup(groupId)) {
      return Object.assign({}, getNewUserWizard(vm), { groupId: groupId })
    }
    return Object.assign({}, getNewGroupWizard(vm), { groupId: groupId })
  }
  function prepareNewGroupObject({ submission, vm, info }) {
    const groupName = info[0]
    const participantName = info[1]
    const nextParticipant = info[2]
    // Format the parallelSurvey object
    const parallelSurvey = {
      groupId: Id.uuid(),
      groupName: groupName,
      participantName: participantName,
      submissionId: submission._id
    }

    // Store information of the parallelSurvey on the current submission
    vm.currentSubmission.parallelSurvey =
      Submission().setParallelSurvey(parallelSurvey)

    // New survey Information
    const surveyData = {
      parallelSurvey: Submission().setParallelSurvey({
        ...parallelSurvey,
        participantName: nextParticipant
      })
    }

    return surveyData
  }

  function prepareNewUserObject({ submission, info }) {
    const participantName = info[0]
    const parallelsurveyInfo = Submission().getParallelSurvey(submission)

    parallelsurveyInfo.participantName = participantName
    // New survey Information
    const surveyData = {
      parallelSurvey: Submission().setParallelSurvey(parallelsurveyInfo)
    }

    return surveyData
  }

  async function createNewSurvey({ submission, vm, info }) {
    const groupId = getGroupId(submission)

    if (submissionHasGroup(groupId)) {
      return prepareNewUserObject({ submission, vm, info })
    }
    return prepareNewGroupObject({ submission, vm, info })
  }

  async function assignSelfId(created) {
    console.log(created)
  }

  return Object.freeze({
    createWizard,
    createNewSurvey,
    assignSelfId
  })
})()

export default ParallelSurvey
