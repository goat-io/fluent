// npx vitest run ./src/server/services/email/email.service.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SendgridService } from '../sendgrid/sendgridApi.service'
import type { EmailTemplates, EmailTest, Theme } from './email.model'
import { Content, EmailCategory, Layout } from './email.model'
import { EmailService } from './email.service'

// Mock dependencies
vi.mock('ejs', () => ({
  renderFile: vi.fn()
}))

vi.mock('mjml', () => ({
  default: vi.fn()
}))

vi.mock('@goatlab/js-utils', () => ({
  Strings: {
    capitalize: vi.fn(str => str.charAt(0).toUpperCase() + str.slice(1))
  }
}))

vi.mock('../../consts', () => ({
  config: {
    templateDir: '/test/templates'
  }
}))

describe('EmailService', () => {
  let emailService: EmailService
  let mockSendgridService: SendgridService
  let mockTheme: Theme
  let mockTemplate: EmailTemplates

  beforeEach(() => {
    // Mock SendgridService
    mockSendgridService = {
      sendFinalizedEmail: vi.fn()
    } as any

    mockTheme = {
      logo: 'https://example.com/logo.png',
      logoLink: 'https://example.com',
      primaryColor: '#000000',
      buttonTextColor: '#ffffff',
      privacyPolicyLink: 'https://example.com/privacy',
      unsubscribeLink: 'https://example.com/unsubscribe',
      facebook: 'example',
      instagram: 'example',
      twitter: 'https://twitter.com/example',
      appName: 'Example App'
    }

    mockTemplate = {
      layout: Layout.default,
      content: Content.simple,
      categories: [EmailCategory.SIMPLE],
      placeholders: {
        greeting: 'Hello',
        body: 'Test body',
        footer: 'Test footer'
      }
    }

    emailService = new EmailService({
      fromName: 'Test Company',
      shouldSendEmail: true,
      baseDomain: 'example.com',
      emailTransport: mockSendgridService,
      emailArchive: 'archive@example.com',
      theme: mockTheme
    })

    // Reset environment variables
    process.env.TEST_EMAIL_ADDRESS = undefined
    process.env.K_SERVICE = undefined
    process.env.CLOUD_RUN_JOB = undefined

    // Mock process.platform
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default base domain when not provided', () => {
      const service = new EmailService({
        fromName: 'Test',
        shouldSendEmail: true,
        emailTransport: mockSendgridService,
        theme: mockTheme
      })

      expect(service).toBeDefined()
    })

    it('should use provided base domain', () => {
      const service = new EmailService({
        fromName: 'Test',
        shouldSendEmail: true,
        baseDomain: 'custom.com',
        emailTransport: mockSendgridService,
        theme: mockTheme
      })

      expect(service).toBeDefined()
    })
  })

  describe('sendEmailFromTemplate', () => {
    beforeEach(async () => {
      const ejs = await vi.importMock<typeof import('ejs')>('ejs')
      const mjml = await vi.importMock<typeof import('mjml')>('mjml')

      vi.mocked(ejs.renderFile).mockResolvedValue('<mjml>test content</mjml>')
      vi.mocked(mjml.default).mockReturnValue({
        html: '<html>compiled</html>',
        errors: []
      })

      mockSendgridService.sendFinalizedEmail = vi.fn().mockResolvedValue({
        isSuccess: true,
        statusCode: 202,
        body: 'Email sent successfully',
        headers: {}
      })
    })

    it('should not send email when shouldSendEmail is false', async () => {
      const service = new EmailService({
        fromName: 'Test',
        shouldSendEmail: false,
        emailTransport: mockSendgridService,
        theme: mockTheme
      })

      const result = await service.sendEmailFromTemplate({
        template: mockTemplate,
        to: 'test@example.com',
        subject: 'Test Subject'
      })

      expect(result).toEqual({
        isSuccess: true,
        statusCode: 1,
        body: 'Email not sent. No emails are sent in test mode',
        headers: {}
      })

      expect(mockSendgridService.sendFinalizedEmail).not.toHaveBeenCalled()
    })

    it('should compile template and send email successfully', async () => {
      const result = await emailService.sendEmailFromTemplate({
        template: mockTemplate,
        to: 'test@example.com',
        subject: 'Test Subject'
      })

      expect(result.isSuccess).toBe(true)
      expect(mockSendgridService.sendFinalizedEmail).toHaveBeenCalledWith({
        html: '<html>compiled</html>',
        fromEmail: 'info@example.com',
        fromName: 'Test Company',
        subject: 'Test Subject',
        replyTo: 'no_reply@example.com',
        recipients: [{ email: 'test@example.com' }],
        attachments: undefined,
        categories: [EmailCategory.SIMPLE],
        bcc: []
      })
    })

    it('should send to base domain emails in non-production', async () => {
      await emailService.sendEmailFromTemplate({
        template: mockTemplate,
        to: 'user@example.com',
        subject: 'Test Subject'
      })

      expect(mockSendgridService.sendFinalizedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [{ email: 'user@example.com' }]
        })
      )
    })

    it('should redirect to TEST_EMAIL_ADDRESS for non-base domain emails in non-production', async () => {
      process.env.TEST_EMAIL_ADDRESS = 'test@test.com'

      await emailService.sendEmailFromTemplate({
        template: mockTemplate,
        to: 'user@external.com',
        subject: 'Test Subject'
      })

      expect(mockSendgridService.sendFinalizedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [{ email: 'test@test.com' }]
        })
      )
    })

    it('should fail when TEST_EMAIL_ADDRESS is not set for non-base domain emails', async () => {
      // Ensure TEST_EMAIL_ADDRESS is not set
      delete process.env.TEST_EMAIL_ADDRESS

      const result = await emailService.sendEmailFromTemplate({
        template: mockTemplate,
        to: 'user@external.com',
        subject: 'Test Subject'
      })

      expect(result).toEqual({
        isSuccess: false,
        statusCode: 1,
        body: 'Email not sent. TEST_EMAIL_ADDRESS env variable is missing',
        headers: {}
      })

      expect(mockSendgridService.sendFinalizedEmail).not.toHaveBeenCalled()
    })

    it('should detect GCP environment (Cloud Run)', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })
      process.env.K_SERVICE = 'test-service'

      await emailService.sendEmailFromTemplate({
        template: mockTemplate,
        to: 'user@external.com',
        subject: 'Test Subject'
      })

      expect(mockSendgridService.sendFinalizedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [{ email: 'user@external.com' }]
        })
      )
    })
  })

  describe('sendEmailTemplateTest', () => {
    beforeEach(async () => {
      const mjml = await vi.importMock<typeof import('mjml')>('mjml')
      vi.mocked(mjml.default).mockReturnValue({
        html: '<html>test email</html>',
        errors: []
      })

      mockSendgridService.sendFinalizedEmail = vi.fn().mockResolvedValue({
        isSuccess: true,
        statusCode: 202,
        body: 'Test email sent',
        headers: {}
      })
    })

    it('should send test email to base domain user', async () => {
      const emailTest: EmailTest = {
        to: 'testuser@example.com',
        subject: 'Test Email',
        mjml: '<mjml><mj-body>Test</mj-body></mjml>'
      }

      const result = await emailService.sendEmailTemplateTest(emailTest)

      expect(result.isSuccess).toBe(true)
      expect(mockSendgridService.sendFinalizedEmail).toHaveBeenCalledWith({
        html: '<html>test email</html>',
        fromEmail: 'info@example.com',
        fromName: 'Test Company',
        subject: 'Test Email',
        replyTo: 'no_reply@example.com',
        recipients: [{ email: 'testuser@example.com' }],
        categories: [EmailCategory.TEST_EMAIL]
      })
    })

    it('should throw error for non-base domain emails', async () => {
      const emailTest: EmailTest = {
        to: 'user@external.com',
        subject: 'Test Email',
        mjml: '<mjml><mj-body>Test</mj-body></mjml>'
      }

      await expect(
        emailService.sendEmailTemplateTest(emailTest)
      ).rejects.toThrow('Cannot send emails to external.com accounts')
    })
  })
})
