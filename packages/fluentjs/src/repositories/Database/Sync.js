import Submission from '../../models/Submission'
import User from '../../models/User'
import Auth from '../Auth/Auth'
import OfflineData from '../Submission/OfflineData'
import Scheduler from './Scheduler'

const Sync = class {
  /**
   *
   * @param {*} vm
   */
  static async now(vm) {
    await Sync.syncUsers()

    if (Auth().connector().check()) {
      await Sync.syncSubmission(vm)
    }
  }
  /**
   *
   * @param {*} db
   * @param {*} vm
   */
  static async syncSubmission() {
    const usersAreSync = await Sync.areUsersSynced()

    if (!usersAreSync) {
      return
    }

    const unsyncSubmissions = await Submission().getUnsync()

    const isSyncing = await Scheduler.isSyncing()

    if (unsyncSubmissions.length > 0 && !isSyncing) {
      OfflineData.send(unsyncSubmissions)
    }
  }
  /**
   *
   */
  static async getUsersToSync() {
    return await User.local()
      .where('sync', '=', false)
      .andWhere('queuedForSync', '=', false)
      .andWhere('syncError', '=', false)
      .get()
  }
  /**
   *
   */
  static async areUsersSynced() {
    const users = await Sync.getUsersToSync()

    return !!users && Array.isArray(users) && users.length === 0
  }
  /**
   *
   * @param {*} param
   */
  static async syncUsers() {
    const users = await Sync.getUsersToSync()

    const isSyncing = await Scheduler.isSyncing()

    if (Array.isArray(users) && users.length > 0 && !isSyncing) {
      OfflineData.syncUsers(users)
    }
  }
}

export default Sync
