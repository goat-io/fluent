let GoatIsSyncing = false
const Scheduler = class {
  static async isSyncing() {
    return GoatIsSyncing
  }
  static async startSync() {
    GoatIsSyncing = true
    return Scheduler.isSyncing()
  }

  static async stopSync() {
    GoatIsSyncing = false
    return Scheduler.isSyncing()
  }
}

export default Scheduler
