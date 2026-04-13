import { GenericContainer } from 'testcontainers'

export const typesenseContainer = new GenericContainer(
  'typesense/typesense:29.0',
)
  .withEnvironment({
    TYPESENSE_API_KEY: 'MY_API_KEY',
  })
  .withCommand([
    '--data-dir',
    '/tmp',
    '--api-key',
    'MY_API_KEY',
    '--enable-cors',
    'true',
    '--enable-search-analytic',
    'true',
    '--analytics-dir',
    '/path/to/analytics-data',
    '--analytics-flush-interval',
    '300',
  ])
  .withExposedPorts(8108)
