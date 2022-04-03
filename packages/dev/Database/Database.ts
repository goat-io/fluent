import { join } from 'path'
import { Docker } from '../Docker'

export const Database = (() => {
  /**
   *
   */
  const mongo = async (info?: {
    version?: '4.2' | '4.4'
    imageName?: string
  }): Promise<any> => {
    const name = info?.imageName || 'mynewmongo'

    await Docker.buildImage({
      imageName: name,
      context: join(__dirname, `./MongoDB/${info?.version || '4.2'}`),
      src: ['Dockerfile', 'setup.sh']
    })

    const container = (await Docker.runContainer({
      image: name
    })) as any

    return container
  }

  return Object.freeze({ mongo })
})()
