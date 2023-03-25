import { getGot } from './getGot'

test('Should get data', async () => {
  const client = await getGot({
    prefixUrl: 'https://cat-fact.herokuapp.com/facts'
  })
  const facts = await client.get('').json<any[]>()

  expect(facts).toBeDefined()
  expect(facts.length).toBeGreaterThan(0)
})
