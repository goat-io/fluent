import { describe } from 'vitest'
import { RabbitMQBroker } from './RabbitMQ'
import { getGlobalData } from '../test/const'
import { runMessageBrokerTestSuite } from './sharedBrokerTests'

describe('RabbitMQBroker', () => {
  const { rabbitMQUrl } = getGlobalData()
  const broker = new RabbitMQBroker(rabbitMQUrl)
  runMessageBrokerTestSuite(broker)
})
