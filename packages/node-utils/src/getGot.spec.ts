import { getGot } from './getGot'

const client = getGot({
  prefixUrl: 'https://cat-fact.herokuapp.com/facts'
})

test('Should get data', async () => {
  const facts = await client.get('').json<any[]>()

  expect(facts).toBeDefined()
  expect(facts.length).toBeGreaterThan(0)
})
