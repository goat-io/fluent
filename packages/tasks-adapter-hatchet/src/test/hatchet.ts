import { GenericContainer, StartedNetwork, Wait } from 'testcontainers'

export const getHatchetContainer = ({
  postgresConnectionString,
  network,
}: {
  postgresConnectionString: string
  network: StartedNetwork
}) => {
  return new GenericContainer('ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest')
    .withEnvironment({
      DATABASE_URL: postgresConnectionString,
      SERVER_AUTH_COOKIE_DOMAIN: 'localhost',
      SERVER_AUTH_COOKIE_INSECURE: 't',
      SERVER_GRPC_BIND_ADDRESS: '0.0.0.0',
      SERVER_GRPC_INSECURE: 't',
      SERVER_GRPC_BROADCAST_ADDRESS: 'localhost:7077',
      SERVER_GRPC_PORT: '7077',
      SERVER_URL: 'http://localhost:8888',
      SERVER_AUTH_SET_EMAIL_VERIFIED: 't',
      SERVER_DEFAULT_ENGINE_VERSION: 'V1',
      SERVER_INTERNAL_CLIENT_INTERNAL_GRPC_BROADCAST_ADDRESS: 'localhost:7077',
    })
    .withNetwork(network)
    .withExposedPorts(8888, 7077)
    .withWaitStrategy(
      Wait.forLogMessage(
        `created tenant 707d0855-80ab-4e1f-a156-f1c4546cbf52`,
        1,
      ).withStartupTimeout(60_000),
    )
}
