import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { StartedNetwork } from 'testcontainers'

export const getPostgres = ({ network }: { network: StartedNetwork }) => {
  return new PostgreSqlContainer('postgres:17-alpine')
    .withNetwork(network)
    .withNetworkAliases('db')
    .withExposedPorts(5432)
}
