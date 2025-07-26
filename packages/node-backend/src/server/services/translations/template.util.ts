import type { AnyObject } from '@goatlab/js-utils'
import type { PupaOptions } from '@goatlab/js-utils/dist/Strings/pupa'
import { Strings } from '@goatlab/js-utils'

class TemplateUtil {
  renderString(
    tmpl: string,
    params: AnyObject = {},
    opt: PupaOptions = {},
  ): string {
    return Strings.pupa(tmpl, params, opt)
  }
}

export const templateUtil = new TemplateUtil()
