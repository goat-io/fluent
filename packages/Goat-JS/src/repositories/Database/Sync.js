import User from 'models/User';
import Auth from 'repositories/Auth/Auth';
import Submission from 'models/Submission';
import OfflineData from 'repositories/Submission/OfflineData';
import Scheduler from 'repositories/Database/Scheduler';

let Sync = class {
  /**
   *
   * @param {*} vm
   */
  static async now (vm) {
    await Sync.syncUsers();

    if (Auth.check()) {
      await Sync.syncSubmission(vm);
    }
  }
  /**
   *
   * @param {*} db
   * @param {*} vm
   */
  static async syncSubmission () {
    let usersAreSync = await Sync.areUsersSynced();

    if (!usersAreSync) {
      return;
    }

    let unsyncSubmissions = await Submission().getUnsync();

    let isSyncing = await Scheduler.isSyncing();

    if (unsyncSubmissions.length > 0 && !isSyncing) {
      OfflineData.send(unsyncSubmissions);
    }
  }
  /**
   *
   */
  static async getUsersToSync () {
    return await User.local()
      .where('sync', '=', false)
      .andWhere('queuedForSync', '=', false)
      .andWhere('syncError', '=', false)
      .get();
  }
  /**
   *
   */
  static async areUsersSynced () {
    let users = await Sync.getUsersToSync();

    return !!users && Array.isArray(users) && users.length === 0;
  }
  /**
   *
   * @param {*} param
   */
  static async syncUsers () {
    let users = await Sync.getUsersToSync();

    let isSyncing = await Scheduler.isSyncing();

    if (Array.isArray(users) && users.length > 0 && !isSyncing) {
      OfflineData.syncUsers(users);
    }
  }
};

export default Sync;
