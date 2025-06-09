// npx jest -i ./src/scripts.spec.ts

import { Scripts } from './Scripts'

describe('Scripts.run', () => {
  const originalExit = process.exit
  const originalConsole = console
  let mockExit: jest.MockedFunction<(code?: number) => never>
  let mockLog: jest.Mock
  let mockError: jest.Mock

  beforeEach(() => {
    const mockExitFn = jest.fn() as any

    mockExit = mockExitFn
    process.exit = mockExit as typeof process.exit
    mockLog = jest.fn()
    mockError = jest.fn()
    console.log = mockLog
    console.error = mockError
  })

  afterEach(() => {
    process.exit = originalExit
    console.log = originalConsole.log
    console.error = originalConsole.error
  })

  it('should resolve and call process.exit(0)', async () => {
    await new Promise<void>(resolve => {
      Scripts.run(async () => {
        Promise.resolve()
        resolve()
      })
    })
    await new Promise(r => setImmediate(r))
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('should catch error and call process.exit(1)', async () => {
    await new Promise<void>(resolve => {
      Scripts.run(() => {
        return Promise.reject(new Error('fail'))
      })
      setTimeout(resolve, 10)
    })

    await new Promise(r => setImmediate(r))
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('runScript error:'),
      expect.any(Error)
    )
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should not call process.exit when noExit is true', async () => {
    await new Promise<void>(resolve => {
      Scripts.run(() => Promise.resolve().then(() => resolve(undefined)), {
        noExit: true
      })
    })

    await new Promise(r => setImmediate(r))
    expect(mockExit).not.toHaveBeenCalled()
  })

  it('should catch sync error and call process.exit(1)', async () => {
    await new Promise<void>(resolve => {
      Scripts.run(() => {
        throw new Error('sync fail')
      })
      setTimeout(resolve, 10)
    })

    await new Promise(r => setImmediate(r))
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining('runScript error:'),
      expect.any(Error)
    )
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('should resolve and not exit when noExit is true and value returned', async () => {
    await new Promise<void>(resolve => {
      Scripts.run(() => Promise.resolve('done'), {
        noExit: true
      })
      setTimeout(resolve, 10)
    })

    await new Promise(r => setImmediate(r))
    expect(mockExit).not.toHaveBeenCalled()
  })
})
