import { nextAvailablePort } from './Ports'

it('Should get available port', async () => {
  const port = await nextAvailablePort()
  expect(typeof port).toBe('number')
})
