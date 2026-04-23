/**
 * Cluster launcher for delphi workers.
 *
 * Forks N processes for parallel step execution. Each fork runs the
 * provided `start` function independently — its own HTTP server, engine,
 * and WorkerSelfRegistration.
 *
 * Usage:
 *   import { clusterStart } from '@goatlab/delphi-core'
 *
 *   clusterStart({
 *     workers: 2,          // 2 forks (or 'auto' for all cores)
 *     start: () => startServer(),
 *   })
 *
 * When workers=1 (default), no forking — calls start() directly.
 */
import cluster from 'node:cluster'
import { cpus } from 'node:os'

export interface ClusterStartConfig {
  /** Number of worker processes. 'auto' = os.cpus().length. Default: 1 (no fork). */
  workers?: number | 'auto'
  /** Function to run in each worker (or in the main process if workers=1). */
  start: () => void | Promise<void>
  /** Called when a worker dies. Default: restart it. */
  onWorkerExit?: (
    workerId: number,
    code: number | null,
    signal: string | null,
  ) => void
}

export function clusterStart(config: ClusterStartConfig): void {
  const requested = config.workers ?? 1
  const workerCount = requested === 'auto' ? cpus().length : requested

  // No forking needed
  if (workerCount <= 1) {
    config.start()
    return
  }

  if (cluster.isPrimary) {
    console.log(
      `[delphi:cluster] Primary ${process.pid} forking ${workerCount} workers`,
    )

    for (let i = 0; i < workerCount; i++) {
      cluster.fork({
        DELPHI_WORKER_INDEX: String(i),
        DELPHI_WORKER_COUNT: String(workerCount),
      })
    }

    cluster.on('exit', (worker, code, signal) => {
      const id = worker.process.pid ?? 0
      if (config.onWorkerExit) {
        config.onWorkerExit(id, code, signal)
      } else {
        console.log(
          `[delphi:cluster] Worker ${id} died (code=${code}, signal=${signal}). Restarting...`,
        )
        cluster.fork({
          DELPHI_WORKER_INDEX: '0',
        })
      }
    })
  } else {
    config.start()
  }
}
