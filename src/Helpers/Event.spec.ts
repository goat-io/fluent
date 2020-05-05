import { Event } from './Event'
import { Connection } from './Connection'

const event = { data: { test: 'true' }, text: 'Some test' }
let eventWorked = false

const changeEventStatus = () => {
  eventWorked = !eventWorked
}

const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time))
}

beforeAll(() => {
  Event.listen('myBasicEvent', changeEventStatus)
})

it('emit() and listen() Should should work in sync', async () => {
  expect(eventWorked).toBe(false)
  Event.emit('myBasicEvent', event)
  while (!eventWorked) {
    console.log('waiting for event to trigger...')
    await sleep(500)
  }
  expect(eventWorked).toBe(true)
})

it('remove() should delete the event', async () => {
  expect(eventWorked).toBe(true)
  Event.emit('myBasicEvent', event)

  expect(eventWorked).toBe(false)

  Event.remove('myBasicEvent', changeEventStatus)
  Event.emit('myBasicEvent', event)
  expect(eventWorked).toBe(false)
})
