import 'reflect-metadata'

import { Network } from 'testcontainers'
import { getFirebaseContainer } from './src/test/container/firebase'
import { cleanGlobalData, writeGlobalData } from './src/test/const'

export default async () => {
  // create shared network
  const network = await new Network().start()
  const firebaseContainer = await getFirebaseContainer({ network }).start()

  const firebaseConnection = {
    host: firebaseContainer.getName().replace('/', ''),
    port5000: firebaseContainer.getMappedPort(5000),
    port5001: firebaseContainer.getMappedPort(5001),
    port8080: firebaseContainer.getMappedPort(8080),
    port8085: firebaseContainer.getMappedPort(8085),
    port9000: firebaseContainer.getMappedPort(9000),
    port3000: firebaseContainer.getMappedPort(3000),
    port4000: firebaseContainer.getMappedPort(4000)
  }

  console.log(firebaseConnection)

  //   writeGlobalData({
  //     token,

  //   })

  return async () => {
    await firebaseContainer.stop()

    cleanGlobalData()
  }
}
