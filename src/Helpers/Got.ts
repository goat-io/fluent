import got, { HTTPError } from 'got'
import type { Options, BeforeErrorHook } from 'got'

export function Got(opt: Options = {}) {
  return got.extend({
    timeout: 90000,
    ...opt,
    hooks: {
      ...opt.hooks,
      beforeError: [...(opt.hooks?.beforeError || []), ParseErrorHook()]
    }
  })
}

function ParseErrorHook(): BeforeErrorHook {
  return error => {
    if (error instanceof HTTPError) {
      const { statusCode } = error.response
      const { method, url } = error.options

      const body = error.response.body

      error.message = [
        [statusCode, method, url].filter(Boolean).join(' '),
        body
      ]
        .filter(Boolean)
        .join('\n')
    }

    return error
  }
}
