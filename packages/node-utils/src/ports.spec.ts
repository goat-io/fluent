import { Ports } from './Ports'

it('Should get available port', async () => {
  const port = await Ports.nextAvailablePort(3000)
  expect(typeof port).toBe('number')
  expect(port >= 3000).toBe(true)
})
