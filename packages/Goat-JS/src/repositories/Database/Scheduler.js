var FastIsSyncing = false;
let Scheduler = class {
  static async isSyncing () {
    return FastIsSyncing;
  }
  static async startSync () {
    FastIsSyncing = true;
    return this.isSyncing();
  }

  static async stopSync () {
    FastIsSyncing = false;
    return this.isSyncing();
  }
};

export default Scheduler;
