const VError = require('verror')
const createError = require('http-errors')
// import gLog from "./gLogs";

export const Error = (params: any) => {
  const cause = params[0]
  const message = params[1]
  const info = params[2]

  const stackableError = new VError(
    {
      cause,
      info
    },
    message
  )
  // gLog().error(fullErrorMessage);

  const details = {
    ...info,
    ...{ errors: cause },
    ...{ stack: stackableError.stack }
  }
  if (info && info.code) {
    return {
      httpError: createError(info.code, message, {
        info,
        details: details
      }),
      stack: stackableError
    }
  }
  return stackableError
}
