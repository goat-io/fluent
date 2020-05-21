import Docker from 'dockerode'
import { join } from 'path'
const docker = new Docker({
  socketPath: '/var/run/docker.sock'
})
export const Database = (() => {
  /**
   *
   */
  const waitForStream = stream =>
    new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) =>
        err ? reject(err) : resolve(res)
      )
    })
  /**
   *
   */
  const BuildImage = (name: string) =>
    new Promise((resolve, reject) => {
      docker.buildImage(
        {
          context: join(__dirname, './Databases/MongoDB'),
          src: ['Dockerfile', 'setup.sh']
        },
        { t: name },
        async (err, stream) => {
          if (err) {
            console.log(err)
            reject(err)
          }
          const done = await waitForStream(stream)
          resolve(done)
        }
      )
    })

  /**
   *
   * @param image
   * @param command
   */
  const runContainer = (image: string, command: string[]) =>
    new Promise((resolve, reject) => {
      docker.createContainer(
        {
          Image: image,
          Tty: true,
          Cmd: command
        },
        (err, container) => {
          if (err) {
            console.log(err)
            reject(err)
          }

          container.start({}, (err, data) => {
            if (err) {
              console.log(err)
              reject(err)
            }
            resolve(data)
          })
        }
      )
    })
  /**
   *
   */
  const mysql = async (): Promise<string> => {
    const image = await BuildImage('mynewmongo')
    const container = await runContainer('mynewmongo', [])
    console.log(container)
    return 'mysql started'
  }

  return Object.freeze({ mysql })
})()
