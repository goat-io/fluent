import { GenericContainer, StartedNetwork, Wait } from 'testcontainers'

export const getFirebaseContainer = ({
  network,
}: {
  network: StartedNetwork
}) => {
  return new GenericContainer('goatlab/firebase-emulator:1.2')
    .withNetwork(network)
    .withExposedPorts(5000, 5001, 8080, 8085, 9000, 3000, 4000)
    .withCommand([
      'firebase',
      'emulators:start',
      '--only',
      'auth,functions,firestore,pubsub,storage,hosting,database,hub,logging',
      '--project',
      'demo-local-test-emulator',
    ])
    .withWaitStrategy(
      Wait.forLogMessage(
        `Emulator Hub running at 127.0.0.1:4400`,
        1,
      ).withStartupTimeout(60_000),
    )
}
