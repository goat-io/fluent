import { describe } from 'vitest'
import { getGlobalData } from '../test/const'
import { RabbitMQBroker } from './RabbitMQ'
import { runMessageBrokerTestSuite } from './sharedBrokerTests'

describe('RabbitMQBroker', () => {
  const { rabbitMQUrl } = getGlobalData()
  const broker = new RabbitMQBroker(rabbitMQUrl)
  runMessageBrokerTestSuite(broker)
})
