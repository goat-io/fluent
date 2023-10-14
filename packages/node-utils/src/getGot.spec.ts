import { getGot } from './getGot'

const client = getGot({
  prefixUrl: 'https://api.github.com'
})

test('Should get data', async () => {
  const repo = await client.get('repos/octocat/Hello-World').json<any>()

  expect(repo).toBeDefined()
  expect(repo.name).toBe('Hello-World')
})
