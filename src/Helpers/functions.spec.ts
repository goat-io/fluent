import { Functions } from './Functions'
it('Test sleep and repeat', async () => {
  const ar: string[] = []

  Functions.repeatEvery(1000, () => {
    ar.push('A')
  })

  await Functions.sleep(2500)
  expect(ar.length).toBe(2)
})
