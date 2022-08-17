export const isAnyObject = (val: any): boolean => {
  return typeof val === 'object' && !Array.isArray(val) && val !== null
}
