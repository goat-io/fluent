import { AppError } from './app.error'
import type { HttpErrorData } from './error.model'

/**
 * Base class for HTTP errors - errors that define HTTP error code.
 */
export class HttpError<
  DataType extends HttpErrorData = HttpErrorData,
> extends AppError<DataType> {
  constructor(message: string, data: DataType) {
    super(message, data)

    this.constructor = HttpError
    ;(this as any).__proto__ = HttpError.prototype
    Object.defineProperty(this, 'name', {
      value: this.constructor.name,
      configurable: true, // otherwise throws with "TypeError: Cannot redefine property: name"
    })

    if ((Error as any).captureStackTrace) {
      ;(Error as any).captureStackTrace(this, this.constructor)
    } else {
      Object.defineProperty(this, 'stack', {
        value: new Error().stack,
        configurable: true,
      })
    }
  }
}
