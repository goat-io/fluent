var GoatIsSyncing = false;
let Scheduler = class {
  static async isSyncing() {
    return GoatIsSyncing;
  }
  static async startSync() {
    GoatIsSyncing = true;
    return this.isSyncing();
  }

  static async stopSync() {
    GoatIsSyncing = false;
    return this.isSyncing();
  }
};

export default Scheduler;
