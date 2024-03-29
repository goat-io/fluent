import * as _Docker from 'dockerode'

const docker = new _Docker({
  socketPath: '/var/run/docker.sock'
})

// FROM: https://github.com/ForbesLindesay/atdatabases/blob/master/packages/with-container/src/index.ts

import { connect } from 'net'
import spawn = require('cross-spawn')
import { spawnBuffered } from 'modern-spawn'

export const detectPort: (
  defaultPort: number
) => Promise<number> = require('detect-port')

export interface DockerOptions {
  debug: boolean
  image: string
  containerName: string
  defaultExternalPort: number
  externalPort?: number
  internalPort: number
  connectTimeoutSeconds: number
  environment?: { [key: string]: string }
  command?: string[]
  args?: Record<string, string>
  cap_add?: 'SYS_NICE' | 'IPC_LOCK'
  /**
   * By default, we check if the image already exists
   * before pulling it. We only pull if there is no
   * existing image. This is faster, but means we don't
   * get updates to the image.
   */
  refreshImage?: boolean
  detached?: boolean
  enableDebugInstructions?: string
  testConnection?: (
    opts: DockerNormalizedOptions & {
      testPortConnection: () => Promise<boolean>
    }
  ) => Promise<boolean>
}

export interface DockerNormalizedOptions
  extends Pick<
    DockerOptions,
    Exclude<keyof DockerOptions, 'defaultExternalPort'>
  > {
  detached: boolean
  externalPort: number
  args?: Record<string, string>
}

class DockerClass {
  private async imageExists(
    options: DockerNormalizedOptions | DockerOptions
  ): Promise<boolean> {
    const stdout = await spawnBuffered(
      'docker',
      ['images', '--format', '{{json .}}'],
      {
        debug: options.debug
      }
    ).getResult('utf8')
    const existingImages = stdout
      .trim()
      .split('\n')
      .map(str => {
        try {
          return JSON.parse(str)
        } catch (ex) {
          console.log('Unable to parse: ' + str)
          return null
        }
      })
      .filter(n => n != null)
    const [Repository, Tag] = options.image.split(':')
    return existingImages.some(
      i => i.Repository === Repository && (!Tag || i.Tag === Tag)
    )
  }

  private startDockerContainer(options: DockerNormalizedOptions) {
    const env = options.environment || {}
    const envArgs: string[] = []
    Object.keys(env).forEach(key => {
      envArgs.push('--env')
      envArgs.push(`${key}=${env[key]}`)
    })

    const args: string[] = []
    Object.keys(options.args || {}).forEach(key => {
      args.push(key)
      args.push(options.args[key])
    })

    const command = [
      'run',
      '--name',
      options.containerName,
      '-t', // terminate when sent SIGTERM
      '--rm', // automatically remove when container is killed
      '-p', // forward appropriate port
      `${options.externalPort}:${options.internalPort}`,
      ...(options.detached ? ['--detach'] : []),
      // set enviornment variables
      ...envArgs,
      options.image,
      ...args
    ]

    return spawn('docker', command, {
      stdio: options.debug ? 'inherit' : 'ignore'
    })
  }

  public buildImage = async ({
    imageName,
    context,
    version,
    src
  }: {
    imageName: string
    version?: string
    context: string
    src: string[]
  }) => {
    const stream = await docker.buildImage(
      {
        context,
        src
      },
      { t: version ? `${imageName}:${version}` : imageName }
    )

    return new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => {
        if (err) {
          return reject(err)
        }

        if (
          res.some(r => r?.stream?.includes(`Successfully tagged ${imageName}`))
        ) {
          return resolve(true)
        }

        return reject(new Error('Could not build de image'))
      })
    })
  }

  public listContainers = () => docker.listContainers()

  public listImages = () => docker.listImages()

  public async testConnection(
    options: DockerNormalizedOptions
  ): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const connection = connect(options.externalPort)
        .on('error', () => {
          resolve(false)
        })
        .on('connect', () => {
          connection.end()
          resolve(true)
        })
    })
  }

  public async killOldContainers(
    options: Pick<DockerNormalizedOptions, 'debug' | 'containerName'>
  ) {
    await spawnBuffered('docker', ['kill', options.containerName], {
      debug: options.debug
    }) // do not check exit code as there may not be a container to kill
    await spawnBuffered('docker', ['rm', options.containerName], {
      debug: options.debug
    }) // do not check exit code as there may not be a container to remove
  }

  public async pullDockerImage(
    options: DockerNormalizedOptions | DockerOptions
  ) {
    if (
      !options.refreshImage &&
      /.+\:.+/.test(options.image) &&
      (await this.imageExists(options))
    ) {
      console.log(
        options.image +
          ' already pulled (use mysql-test start --refresh or ops.refreshImage to refresh)'
      )
      return
    }
    console.log('Pulling Docker Image ' + options.image)
    await spawnBuffered('docker', ['pull', options.image], {
      debug: options.debug
    }).getResult()
  }

  public async startContainer(options: DockerOptions) {
    if (isNaN(options.connectTimeoutSeconds)) {
      throw new Error('connectTimeoutSeconds must be a valid integer.')
    }

    await Promise.all([
      this.pullDockerImage(options),
      this.killOldContainers(options)
    ])

    const { defaultExternalPort, ...rawOptions } = options
    const externalPort =
      rawOptions.externalPort || (await detectPort(defaultExternalPort))
    if (typeof externalPort !== 'number') {
      throw new Error('Expected external port to be a number')
    }
    const opts: DockerNormalizedOptions = {
      detached: false,
      ...rawOptions,
      externalPort
    }

    console.log('Starting Docker Container ' + opts.containerName)
    const proc = this.startDockerContainer(opts)

    await this.waitForContainerToStart(opts)

    return {
      proc,
      externalPort,
      kill: async () => {
        return await this.killOldContainers(options)
      }
    }
  }

  public async waitForContainerToStart(options: DockerNormalizedOptions) {
    await new Promise<void>((resolve, reject) => {
      let finished = false
      const timeout = setTimeout(() => {
        finished = true
        reject(
          new Error(
            `Unable to connect to database after ${
              options.connectTimeoutSeconds
            } seconds.${
              options.enableDebugInstructions
                ? ` ${options.enableDebugInstructions}`
                : ``
            }`
          )
        )
      }, options.connectTimeoutSeconds * 1000)
      function test() {
        console.log(
          `Waiting for ${options.containerName} on port ${options.externalPort}...`
        )
        ;(options.testConnection
          ? options.testConnection({
              ...options,
              testPortConnection: async () => await this.testConnection(options)
            })
          : this.testConnection(options)
        ).then(
          isConnected => {
            if (finished) return
            if (isConnected) {
              finished = true
              clearTimeout(timeout)
              setTimeout(resolve, 1000)
            } else {
              setTimeout(test, 500)
            }
          },
          err => {
            reject(err)
          }
        )
      }
      test()
    })
  }

  public raw() {
    return docker
  }
}

export const Docker = new DockerClass()
