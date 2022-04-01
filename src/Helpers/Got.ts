import type { ExtendOptions, BeforeErrorHook } from 'got'
const got = require('got')

export function Got(opt?: ExtendOptions) {
  return got.extend({
    ...(opt || {}),
    hooks: {
      ...opt.hooks,
      beforeError: [...(opt.hooks?.beforeError || []), ParseErrorHook()]
    }
  })
}

function ParseErrorHook(): BeforeErrorHook {
  return error => {
    if (error instanceof got.HTTPError) {
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
