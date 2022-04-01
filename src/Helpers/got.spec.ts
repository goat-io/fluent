import { Got } from './Got'

const got = Got({
  prefixUrl: 'https://yesno.wtf/',
  retry: {
    limit: 3
  }
})

it('It should get data', async () => {
  const a = await got.get('api?force=yes').json()
  expect(a['answer']).toBe('yes')
})

it('It should fail with custom error', async () => {
  try {
    const a = await got.get('someFailingApi').json()
  } catch (error) {
    expect(error.message.includes('404 GET')).toBe(true)
  }
})
