import * as zod from 'zod'

// Create a proxy for the z object that intercepts the record method
const zProxy = new Proxy(zod.z, {
  get(target, prop) {
    if (prop === 'record') {
      // Return a wrapped record function that handles both old and new signatures
      return function record(...args: any[]) {
        if (args.length === 1) {
          // New signature: z.record(valueType)
          // Convert to old signature: z.record(z.string(), valueType)
          return (target as any).record(zod.z.string(), args[0])
        }
        // Old signature: z.record(keyType, valueType)
        return (target as any).record(...args)
      }
    }
    return (target as any)[prop]
  }
})

// Export the proxied z object and all other exports from zod
export { zProxy as z }
export * from 'zod'