export const Dates = () => {
  const unixDate = () => {
    return Math.round(+new Date() / 1000)
  }
  return Object.freeze({ unixDate })
}
