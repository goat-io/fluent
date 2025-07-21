import { Network } from 'testcontainers'
import { writeGlobalData, cleanGlobalData } from './src/test/const'
import { getMysqlContainer } from './src/test/containers/mysql'
import { getMetabaseContainer } from './src/test/containers/metabase'
import { MetabaseApi } from './src/MetabaseApi'

export default async () => {
  console.log('Starting test containers...')

  // Create a network for containers to communicate
  const network = await new Network().start()

  // Start MySQL container
  console.log('Starting MySQL container...')
  const mysqlContainer = await getMysqlContainer(network).start()
  const mysqlHost = mysqlContainer.getHost()
  const mysqlPort = mysqlContainer.getMappedPort(3306)

  console.log(`MySQL started at ${mysqlHost}:${mysqlPort}`)

  // Start Metabase container
  console.log('Starting Metabase container...')
  const metabaseContainer = await getMetabaseContainer(network).start()

  const metabaseHost = '127.0.0.1'
  const metabasePort = metabaseContainer.getMappedPort(3000)
  const metabaseUrl = `http://${metabaseHost}:${metabasePort}`

  console.log(`Metabase started at ${metabaseUrl}`)

  // Wait for Metabase to be fully initialized
  console.log('Waiting for Metabase to initialize...')
  await MetabaseApi.waitForMetabase(metabaseUrl)

  // Try to create admin user or login if already exists
  console.log('Setting up admin user...')

  const sessionToken = await MetabaseApi.createAdminUser({
    baseUrl: metabaseUrl,
    userName: 'admin@mysqluniquetest.com',
    password: 'Xk9#mP2$qR7!vN4&zT8@'
  })

  // Write global data for tests to use
  writeGlobalData({
    metabaseUrl,
    mysqlHost,
    mysqlPort,
    mysqlDatabase: 'metabase_test',
    mysqlUser: 'metabase_user',
    mysqlPassword: 'metabase_pass',
    metabaseSessionToken: sessionToken
  })

  console.log('Test setup complete!')

  return async () => {
    console.log('Cleaning up test containers...')
    await metabaseContainer.stop()
    await mysqlContainer.stop()
    await network.stop()
    cleanGlobalData()
  }
}
