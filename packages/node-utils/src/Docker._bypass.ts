import { join } from 'path'
import { Docker } from './Docker.js'

jest.setTimeout(30000)

it('runContainer - Should run a specific image', async () => {
  const imageName = 'somerandomimagename'
  const version = '0.0.2'

  await Docker.buildImage({
    imageName,
    context: join(__dirname, './Database/Redis'),
    version,
    src: ['Dockerfile']
  })

  // const a = await Docker.startContainer({ image: imageName, containerName: 'Someanme' })

  // console.log(a)

  const containers = await Docker.listContainers()
  const wasStarted = containers.some(c => c.Image === `${imageName}:${version}`)
  expect(wasStarted).toBe(true)
})

/*


it('buildImage - Should build a basic image from a Dockerfile', async () => {
  const imageName = 'somerandomimagename' || Id.nanoId().toLowerCase()
  const version = '0.0.2'

  await Docker.buildImage({
    imageName,
    context: join(__dirname, './Database/Redis'),
    version,
    src: ['Dockerfile']
  })

  const imagesList = await Docker.listImages()
  const imageDidBuilt = imagesList.some(image =>
    image.RepoTags.some(tags => tags.includes(`${imageName}:${version}`))
  )

  expect(imageDidBuilt).toBe(true)
})
*/
