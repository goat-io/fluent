// npx vitest run ./src/server/services/translations/template.util.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { templateUtil } from './template.util'

// Mock @goatlab/js-utils
vi.mock('@goatlab/js-utils', () => ({
  Strings: {
    pupa: vi.fn(),
  },
}))

describe('TemplateUtil', () => {
  describe('renderString', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should render template with parameters', async () => {
      const { Strings } =
        await vi.importMock<typeof import('@goatlab/js-utils')>(
          '@goatlab/js-utils',
        )
      vi.mocked(Strings.pupa).mockReturnValue('Hello John!')

      const result = templateUtil.renderString('Hello {name}!', {
        name: 'John',
      })

      expect(Strings.pupa).toHaveBeenCalledWith(
        'Hello {name}!',
        { name: 'John' },
        {},
      )
      expect(result).toBe('Hello John!')
    })

    it('should handle empty template', async () => {
      const { Strings } =
        await vi.importMock<typeof import('@goatlab/js-utils')>(
          '@goatlab/js-utils',
        )
      vi.mocked(Strings.pupa).mockReturnValue('')

      const result = templateUtil.renderString('', {})

      expect(Strings.pupa).toHaveBeenCalledWith('', {}, {})
      expect(result).toBe('')
    })

    it('should handle template without parameters', async () => {
      const { Strings } =
        await vi.importMock<typeof import('@goatlab/js-utils')>(
          '@goatlab/js-utils',
        )
      vi.mocked(Strings.pupa).mockReturnValue('Static text')

      const result = templateUtil.renderString('Static text')

      expect(Strings.pupa).toHaveBeenCalledWith('Static text', {}, {})
      expect(result).toBe('Static text')
    })

    it('should pass options to pupa function', async () => {
      const { Strings } =
        await vi.importMock<typeof import('@goatlab/js-utils')>(
          '@goatlab/js-utils',
        )
      vi.mocked(Strings.pupa).mockReturnValue('Hello {name}!')

      const options = { ignoreMissing: true }
      const result = templateUtil.renderString('Hello {name}!', {}, options)

      expect(Strings.pupa).toHaveBeenCalledWith('Hello {name}!', {}, options)
      expect(result).toBe('Hello {name}!')
    })

    it('should handle multiple parameters', async () => {
      const { Strings } =
        await vi.importMock<typeof import('@goatlab/js-utils')>(
          '@goatlab/js-utils',
        )
      vi.mocked(Strings.pupa).mockReturnValue(
        'Hello John, you are 25 years old',
      )

      const params = { name: 'John', age: 25 }
      const result = templateUtil.renderString(
        'Hello {name}, you are {age} years old',
        params,
      )

      expect(Strings.pupa).toHaveBeenCalledWith(
        'Hello {name}, you are {age} years old',
        params,
        {},
      )
      expect(result).toBe('Hello John, you are 25 years old')
    })
  })
})
