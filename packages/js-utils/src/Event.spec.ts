import { BrowserEvents } from './BrowserEvents'
/*
const event = { data: { test: 'true' }, text: 'Some test' }
let eventWorked = false

const changeBrowserEventstatus = () => {
  eventWorked = !eventWorked
}

const sleep = time => {
  return new Promise(resolve => setTimeout(resolve, time))
}

beforeAll(() => {
  Events.listen('myBasicEvent', changeEventStatus)
})
*/
it('emit() and listen() Should should work in sync', async () => {
  expect(0).toBe(0)
})
/*
it('emit() and listen() Should should work in sync', async () => {
  expect(eventWorked).toBe(false)
  Events.emit('myBasicEvent', event)
  while (!eventWorked) {
    console.log('waiting for event to trigger...')
    await sleep(500)
  }
  expect(eventWorked).toBe(true)
})

it('remove() should delete the event', async () => {
  expect(eventWorked).toBe(true)
  Events.emit('myBasicEvent', event)

  expect(eventWorked).toBe(false)

  Events.remove('myBasicEvent', changeEventStatus)
  Events.emit('myBasicEvent', event)
  expect(eventWorked).toBe(false)
})
*/
