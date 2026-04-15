// npx vitest run src/__tests__/unit/container-manager.spec.ts
import Dockerode from 'dockerode'
import type { SandboxExecutorConfig } from '../types/SandboxConfig.js'
import {
  DEFAULT_IMAGE,
  DEFAULT_MEMORY,
  DEFAULT_PIDS_LIMIT,
  DEFAULT_WORKDIR,
} from '../types/SandboxConfig.js'
import { ContainerHandle } from './ContainerHandle.js'

export interface ContainerManagerConfig {
  dockerSocketPath?: string
  logger?: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
}

export class ContainerManager {
  private docker: Dockerode
  private logger: ContainerManagerConfig['logger']

  constructor(config: ContainerManagerConfig = {}) {
    // Auto-detect Docker socket: try Docker Desktop path first, then standard
    const socketPath = config.dockerSocketPath ?? this.detectDockerSocket()
    this.docker = new Dockerode(socketPath ? { socketPath } : undefined)
    this.logger = config.logger ?? {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: () => {},
    }
  }

  /**
   * Create and start a container for a sandbox step execution.
   */
  async createContainer(
    config: SandboxExecutorConfig,
    labels: Record<string, string>,
  ): Promise<ContainerHandle> {
    const image = config.image ?? DEFAULT_IMAGE
    const workdir = config.workdir ?? DEFAULT_WORKDIR
    const resources = config.resources ?? {}

    // Ensure image is available
    await this.ensureImage(image)

    // Build environment variables from secrets
    const env = config.secrets
      ? Object.entries(config.secrets).map(([k, v]) => `${k}=${v}`)
      : []

    // Parse memory string to bytes
    const memoryBytes = this.parseMemory(resources.memory ?? DEFAULT_MEMORY)

    // Docker-in-Docker: mount the host Docker socket so the agent can
    // spin up sibling containers (databases, services, docker compose, etc.)
    const binds = [
      ...(config.volumes?.map(
        v => `${v.hostPath}:${v.containerPath}${v.readOnly ? ':ro' : ''}`,
      ) ?? []),
    ]

    if (config.dockerAccess) {
      // Mount the same socket this ContainerManager is using
      const hostSocket = this.detectDockerSocket() ?? '/var/run/docker.sock'
      binds.push(`${hostSocket}:/var/run/docker.sock`)
    }

    // Security: when dockerAccess is enabled, we need broader capabilities
    // since the agent needs to talk to the Docker daemon
    const needsNetAdmin =
      config.dockerAccess ||
      (config.networkMode === 'bridge' && config.allowedDomains?.length)
    const capDrop = config.dockerAccess ? [] : ['ALL']
    const capAdd = needsNetAdmin ? ['NET_RAW', 'NET_ADMIN'] : []
    const securityOpt = config.dockerAccess ? [] : ['no-new-privileges']

    const container = await this.docker.createContainer({
      Image: image,
      Cmd: ['sleep', 'infinity'], // Keep container alive for exec calls
      WorkingDir: workdir,
      Env: env,
      Labels: {
        'goatlab.agents': 'true',
        'goatlab.sandbox': 'true',
        'goatlab.docker_access': config.dockerAccess ? 'true' : 'false',
        ...labels,
      },
      HostConfig: {
        // Resource limits
        Memory: memoryBytes,
        NanoCpus: (resources.cpus ?? 2) * 1e9,
        PidsLimit: config.dockerAccess
          ? (resources.pidsLimit ?? 1024) // Higher limit when running containers
          : (resources.pidsLimit ?? DEFAULT_PIDS_LIMIT),

        // Security (relaxed when dockerAccess is enabled)
        CapDrop: capDrop,
        CapAdd: capAdd,
        SecurityOpt: securityOpt,

        // Network (default: 'none' for complete isolation)
        NetworkMode: config.networkMode ?? 'none',

        // Volumes (includes Docker socket when dockerAccess enabled)
        Binds: binds.length > 0 ? binds : undefined,

        // Tmpfs for writable areas
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=512m',
        },
      },
    })

    await container.start()

    // Ensure workspace directory exists
    const handle = new ContainerHandle(container, workdir)
    await handle.exec(`mkdir -p ${workdir}`, { cwd: '/' })

    // Apply domain allowlist (iptables) when using 'bridge' mode with restrictions
    if (config.networkMode === 'bridge' && config.allowedDomains?.length) {
      await this.applyDomainAllowlist(handle, config.allowedDomains)
    }

    this.logger!.debug?.(
      `Container ${container.id.substring(0, 12)} started (image: ${image})`,
    )

    return handle
  }

  /**
   * Ensure a Docker image is available locally. Pulls if needed.
   */
  async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect()
    } catch {
      this.logger!.info?.(`Pulling image: ${image}`)
      const stream = await this.docker.pull(image)
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err: any) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  }

  /**
   * Build an image from an inline Dockerfile.
   */
  async buildImage(_dockerfile: string, tag: string): Promise<void> {
    const _tar = await import('node:stream')

    // Create a minimal tar with just the Dockerfile
    // For simplicity, use exec to write Dockerfile and build
    this.logger!.info?.(`Building image: ${tag}`)

    const _Pack = (await import('node:stream')).PassThrough
    // Note: In production, use a proper tar library.
    // For now, write Dockerfile to a temp location and build.
    throw new Error(
      'Inline Dockerfile building not yet implemented. Use a pre-built image.',
    )
  }

  /**
   * Clean up stale containers (older than given age).
   * Uses labels to identify our containers.
   */
  async cleanupStaleContainers(olderThanMs: number): Promise<number> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: ['goatlab.sandbox=true'] },
    })

    const now = Date.now()
    let cleaned = 0

    for (const info of containers) {
      const createdAt = info.Created * 1000
      if (now - createdAt > olderThanMs) {
        try {
          const container = this.docker.getContainer(info.Id)
          await container.stop({ t: 5 }).catch(() => {})
          await container.remove({ force: true })
          cleaned++
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    if (cleaned > 0) {
      this.logger!.info?.(`Cleaned up ${cleaned} stale containers`)
    }

    return cleaned
  }

  /**
   * Get the underlying dockerode instance (for advanced use).
   */
  getDocker(): Dockerode {
    return this.docker
  }

  /**
   * Apply iptables rules inside the container to restrict outbound traffic
   * to only the specified domains. Requires CAP_NET_ADMIN capability.
   */
  private async applyDomainAllowlist(
    handle: ContainerHandle,
    domains: string[],
  ): Promise<void> {
    // Resolve domains to IPs and add iptables rules
    const commands = [
      // Allow loopback
      'iptables -A OUTPUT -o lo -j ACCEPT',
      // Allow established connections
      'iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT',
      // Allow DNS (needed to resolve allowed domains)
      'iptables -A OUTPUT -p udp --dport 53 -j ACCEPT',
      'iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT',
    ]

    // Resolve each domain and allow its IPs
    for (const domain of domains) {
      commands.push(
        `for ip in $(getent hosts ${domain} 2>/dev/null | awk '{print $1}'); do iptables -A OUTPUT -d $ip -j ACCEPT; done`,
      )
    }

    // Drop everything else
    commands.push('iptables -A OUTPUT -j DROP')

    const script = commands.join(' && ')
    try {
      await handle.exec(`sh -c '${script}'`, { cwd: '/', timeout: 10_000 })
      this.logger!.debug?.(`Applied domain allowlist: ${domains.join(', ')}`)
    } catch (err: any) {
      this.logger!.warn?.(
        `Failed to apply domain allowlist (iptables may not be available): ${err.message}`,
      )
    }
  }

  private detectDockerSocket(): string | undefined {
    const { existsSync } = require('node:fs')
    const candidates = [
      process.env.DOCKER_HOST?.replace('unix://', ''),
      `${process.env.HOME}/.docker/run/docker.sock`, // Docker Desktop (macOS)
      '/var/run/docker.sock', // Standard Linux
    ].filter(Boolean) as string[]
    return candidates.find(p => existsSync(p))
  }

  private parseMemory(mem: string): number {
    const match = mem.match(/^(\d+)(g|m|k)?$/i)
    if (!match) {
      return 2 * 1024 * 1024 * 1024 // Default 2GB
    }
    const value = Number.parseInt(match[1], 10)
    const unit = (match[2] ?? 'm').toLowerCase()
    switch (unit) {
      case 'g':
        return value * 1024 * 1024 * 1024
      case 'm':
        return value * 1024 * 1024
      case 'k':
        return value * 1024
      default:
        return value
    }
  }
}
