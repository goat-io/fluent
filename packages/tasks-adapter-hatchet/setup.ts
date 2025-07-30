import { Network } from 'testcontainers'
import { cleanGlobalData, writeGlobalData } from './src/test/const'
import { getHatchetContainer } from './src/test/hatchet'
import { getPostgres } from './src/test/postgres'

export default async () => {
  // create shared network
  const network = await new Network().start()
  const postgresContainer = await getPostgres({ network }).start()

  const connection = {
    host: postgresContainer.getName().replace('/', ''),
    port: postgresContainer.getMappedPort(5432),
    database: postgresContainer.getDatabase(),
    user: postgresContainer.getUsername(),
    password: postgresContainer.getPassword()
  }

  const postgresUri = `postgresql://${connection.user}:${connection.password}@db:5432/${connection.database}`

  const hatchetContainer = await getHatchetContainer({
    postgresConnectionString: postgresUri,
    network: network
  }).start()

  const cmd = await hatchetContainer.exec(
    '/hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs'
  )
  const token = cmd.stdout.trim()

  writeGlobalData({
    token,
    hostAndPort: `localhost:${hatchetContainer.getMappedPort(7077)}`,
    apiUrl: `http://localhost:${hatchetContainer.getMappedPort(8888)}`
  })

  return async () => {
    await postgresContainer.stop()
    await hatchetContainer.stop()
    cleanGlobalData()
  }
}
