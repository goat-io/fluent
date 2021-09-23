import _Docker from 'dockerode'
import { stdout } from 'process'

const docker = new _Docker({
  socketPath: '/var/run/docker.sock'
})

export const Docker = (() => {
  /**
   *
   * @param p
   * @param p.context Path to the base folder of the Dockerfile
   * * @param p.src Path to the files to include with the image Build
   * @returns
   */
  const buildImage = async ({
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

  const runContainer = async ({
    image,
    version = 'latest',
    command = [],
    env = {}
  }: {
    image: string
    version?: string
    command?: string[]
    env?: { [key: string]: string }
  }) => {
    const envArray = Object.keys(env).reduce((reducer, current) => {
      reducer.push(`${current}=${env[current]}`)
      return reducer
    }, [])

    await docker.run(
      `${image}:${version}`,
      command,
      stdout,
      {
        Tty: false,
        Detach: true
      },
      {
      },
      a => {
        console.log('dsadsadsa')
        console.log(a)
      }
    )

    let wasStarted = false
    while (!wasStarted) {
      const containers = await Docker.listContainers()
      wasStarted = containers.some(c => c.Image === `${image}:${version}`)
    }

    return { started: true }
  }

  const listContainers = () => {
    return docker.listContainers()
  }

  const listImages = () => {
    return docker.listImages()
  }

  return Object.freeze({ buildImage, runContainer, listContainers, listImages })
})()
