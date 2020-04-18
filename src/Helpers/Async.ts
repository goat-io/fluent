import { to as ToAsync } from 'await-to-js'
export const Async = (() => {
  const to = ToAsync
  return Object.freeze({ to })
})()
