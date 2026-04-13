import { MySqlContainer } from '@testcontainers/mysql'
import type { StartedNetwork } from 'testcontainers'

export const getMysqlContainer = (network: StartedNetwork) => {
  return new MySqlContainer('mysql:8.0')
    .withDatabase('metabase_test')
    .withUsername('metabase_user')
    .withUserPassword('metabase_pass')
    .withRootPassword('root_pass')
    .withNetwork(network)
    .withNetworkAliases('mysql')
    .withExposedPorts(3306)
    .withStartupTimeout(120000)
    .withCommand([
      '--default-authentication-plugin=mysql_native_password',
      '--bind-address=0.0.0.0',
    ])
    .withEnvironment({
      MYSQL_ROOT_HOST: '%',
    })
}
