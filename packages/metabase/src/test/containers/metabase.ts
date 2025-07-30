import type { StartedNetwork } from 'testcontainers'
import { GenericContainer, Wait } from 'testcontainers'

export const getMetabaseContainer = (network: StartedNetwork) => {
  return new GenericContainer('metabase/metabase:v0.55.8.x')
    .withEnvironment({
      MB_DB_TYPE: 'mysql',
      MB_DB_CONNECTION_URI:
        'mysql://mysql:3306/metabase_test?user=metabase_user&password=metabase_pass'
    })
    .withNetwork(network)
    .withNetworkAliases('metabase')
    .withExposedPorts(3000)
    .withStartupTimeout(180000)
    .withWaitStrategy(Wait.forListeningPorts())
}
