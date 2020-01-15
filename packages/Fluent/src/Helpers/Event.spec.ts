import { Event } from './Event'

let event = { name: 'myBasicEvent', data: { test: 'true' }, text: 'Some test' }
let eventWorked = false

let changeEventStatus = function() {
  eventWorked = !eventWorked
}

function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

beforeAll(() => {
  Event.listen({ name: 'myBasicEvent', callback: changeEventStatus })
})

it('emit() and listen() Should should work in sync', async () => {
  expect(eventWorked).toBe(false)
  Event.emit(event)
  while (!eventWorked) {
    console.log('waiting for event to trigger...')
    await sleep(500)
  }
  expect(eventWorked).toBe(true)
})

it('remove() should delete the event', async () => {
  expect(eventWorked).toBe(true)
  Event.emit(event)

  expect(eventWorked).toBe(false)

  Event.remove({ name: 'myBasicEvent', callback: changeEventStatus })
  Event.emit(event)
  expect(eventWorked).toBe(false)
})
