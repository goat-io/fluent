import { typesenseContainer } from './src/test/typesense'
import { writeGlobalData, cleanGlobalData } from './src/test/const'
// This file runs before jest sets the env
// so we need to load dotenv manually if we want to use env

export default async () => {
  // Replace this with your actual async function
  const typesense = await typesenseContainer.start()
  const typesenseUrl = `http://127.0.0.1:${typesense.getMappedPort(8108)}`

  writeGlobalData({
    typesenseUrl
  })

  return async () => {
    await typesense.stop()

    cleanGlobalData()
  }
}
