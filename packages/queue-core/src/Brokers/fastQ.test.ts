import { describe } from 'vitest'
import { FastQBroker } from './fastQ'
import { runMessageBrokerTestSuite } from './sharedBrokerTests'

describe('FastQBroker', () => {
  const broker = new FastQBroker()
  runMessageBrokerTestSuite(broker)
})
