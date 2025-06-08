import * as os from 'os'
import { Units } from '@goatlab/js-utils'
import { BuildInfo } from './Env'
class ProcessesClass {
  private timer: ReturnType<typeof setInterval>

  memoryUsage() {
    const { rss, external, heapUsed, heapTotal } = process.memoryUsage()
    return {
      rss: Units.megaBytes(rss),
      heapTotal: Units.megaBytes(heapTotal),
      heapUsed: Units.megaBytes(heapUsed),
      external: Units.megaBytes(external)
    }
  }

  memoryUsageFull() {
    const { rss, external, heapUsed, heapTotal } = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    return {
      rss: Units.megaBytes(rss),
      heapTotal: Units.megaBytes(heapTotal),
      heapUsed: Units.megaBytes(heapUsed),
      external: Units.megaBytes(external),
      totalMem: Units.megaBytes(totalMem),
      freeMem: Units.megaBytes(freeMem),
      usedMem: Units.megaBytes(totalMem - freeMem)
    }
  }

  startMemoryTimer(intervalMillis = 1000): void {
    console.log(this.memoryUsage())

    this.timer = setInterval(() => {
      console.log(this.memoryUsage())
    }, intervalMillis)
  }

  stopMemoryTimer(afterMillis = 0): void {
    setTimeout(
      () => clearInterval(this.timer as unknown as number),
      afterMillis
    )
  }

  cpuAvg(): { avg1: string; avg5: string; avg15: string } {
    const avg = os.loadavg()
    return {
      avg1: avg[0]!.toFixed(2),
      avg5: avg[1]!.toFixed(2),
      avg15: avg[2]!.toFixed(2)
    }
  }

  cpuInfo(): { count: number; model: string; speed: number } {
    const c = os.cpus()[0]!
    return {
      count: os.cpus().length,
      model: c.model,
      speed: c.speed
    }
  }

  async cpuPercent(ms: number): Promise<number> {
    const stats1 = this.getCPUInfo()
    const startIdle = stats1.idle
    const startTotal = stats1.total

    return new Promise<number>(resolve => {
      setTimeout(() => {
        const stats2 = this.getCPUInfo()
        const endIdle = stats2.idle
        const endTotal = stats2.total

        const idle = endIdle - startIdle
        const total = endTotal - startTotal
        const perc = idle / total

        resolve(Math.round((1 - perc) * 100))
      }, ms)
    })
  }

  private getCPUInfo() {
    // eslint-disable-next-line unicorn/no-array-reduce
    return os.cpus().reduce(
      (r, cpu) => {
        r['idle'] += cpu.times.idle
        Object.values(cpu.times).forEach(m => (r['total'] += m))
        return r
      },
      {
        idle: 0,
        total: 0
      }
    )
  }

  generateBuildInfoDev(): BuildInfo {
    const now = new Date()
    const ts = Math.round(now.getTime() / 1000)
    const dateComponents = [
      now.getUTCFullYear(),
      (now.getUTCMonth() + 1).toString().padStart(2, '0'),
      now.getUTCDate().toString().padStart(2, '0')
    ]

    const timeComponents = [
      now.getUTCHours().toString().padStart(2, '0'),
      now.getUTCMinutes().toString().padStart(2, '0')
    ]
    const seconds = now.getUTCSeconds().toString().padStart(2, '0')

    const tsStr =
      dateComponents.join('-') + ' ' + timeComponents.join(':') + ':' + seconds

    const ver = [dateComponents.join('') + '_' + timeComponents.join('')].join(
      '_'
    )

    return {
      ts,
      tsStr,
      rev: '',
      branch: '',
      ver,
      env: 'dev',
      dev: true
    }
  }
}
export const Processes = new ProcessesClass()
