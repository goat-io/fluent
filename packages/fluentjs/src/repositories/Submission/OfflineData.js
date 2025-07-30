import to from 'await-to-js'
import Form from '../../models/Form'
import Submission from '../../models/Submission'
import Connection from '../../Wrappers/Connection'
import Event from '../../Wrappers/Event'
import Scheduler from '../Database/Scheduler'

const OfflineData = (() => {
  const sendSubmission = async offlineSubmission => {
    const remoteEndPoint = Form.getModel({
      path: offlineSubmission.path
    }).remote()

    offlineSubmission.queuedForSync = true
    const sub = Submission(offlineSubmission.path)

    // Set the submission as queuedForSync
    await sub.local().update(offlineSubmission)

    const [error, insertedData] = await to(
      remoteEndPoint.insert(offlineSubmission)
    )

    if (error) {
      console.log(error)
      offlineSubmission.queuedForSync = false
      offlineSubmission.syncError = error
      sub.local().update(offlineSubmission)
      throw new Error('Error while Syncing data')
    }
    if (!insertedData._id) {
      throw Error(
        'The remote endpoint did not save the submission properly (no _id back)'
      )
    }

    const [e] = await to(sub.local().remove(offlineSubmission._id))

    if (e) {
      throw new Error('Sync error:Could not remove local submission after sync')
    }
    return true
  }

  async function send(data) {
    const offlineSubmissions = data
    const isOnline = await Connection.isOnline()

    const PromiseEach = async (arr, fn) => {
      for (const item of arr) {
        await fn(item)
      }
    }

    if (isOnline) {
      await Scheduler.startSync()

      const [error] = await to(
        PromiseEach(offlineSubmissions, async offlineSubmission => {
          await sendSubmission(offlineSubmission)
        })
      )

      Scheduler.stopSync()
      if (error) {
        console.log(error)
      }

      console.log('Submissions Synced')
      Event.emit({
        name: 'GOAT:SUBMISSION:SYNCED',
        data: {},
        text: 'The submissions have been synced'
      })
    }
  }

  return Object.freeze({
    send
  })
})()

export default OfflineData
