import to from 'await-to-js'

export const For = (() => {
  const async = to
  return Object.freeze({ async })
})()
