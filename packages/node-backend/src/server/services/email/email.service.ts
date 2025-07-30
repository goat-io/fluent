import { Strings } from '@goatlab/js-utils'
import { renderFile } from 'ejs'
import mjml2html from 'mjml'
import { config } from '../../consts'
import type { SendGridEmailResponse } from '../sendgrid/sendgrid.model'
import { SendgridService } from '../sendgrid/sendgridApi.service'
import type {
  EmailAddress,
  EmailTemplates,
  EmailTest,
  SendEmailFromTemplateParams,
  Theme
} from './email.model'
import { EmailCategory } from './email.model'

export class EmailService {
  private shouldSendEmail: boolean = true
  private baseDomain: string = '@goatlab.com'
  private fromName: string = ''
  private emailTransport: SendgridService | undefined
  private emailArchive: string | undefined
  private theme: Theme | undefined

  constructor({
    fromName,
    shouldSendEmail,
    baseDomain,
    emailTransport,
    emailArchive,
    theme
  }: {
    fromName: string
    shouldSendEmail: boolean
    baseDomain?: string
    emailTransport: SendgridService
    emailArchive?: string
    theme: Theme
  }) {
    this.shouldSendEmail = shouldSendEmail
    this.fromName = fromName

    if (baseDomain) {
      this.baseDomain = baseDomain
    }

    this.emailTransport = emailTransport

    if (emailArchive?.length) {
      this.emailArchive = emailArchive
    }

    if (theme) {
      this.theme = theme
    }
  }

  private async compileTemplate(template: EmailTemplates): Promise<string> {
    const innerContent = await renderFile(
      `${config.templateDir}/${template.content}`,
      {
        ...template.placeholders,
        theme: this.theme
      }
    )

    const html = await renderFile(`${config.templateDir}/${template.layout}`, {
      ...template.placeholders,
      theme: this.theme,
      content: innerContent
    })

    return html
  }

  private compileMjml(mjml: string): string {
    const compiledMjMl = mjml2html(mjml, {
      keepComments: false
    })

    if (compiledMjMl.errors.length) {
      console.log(compiledMjMl.errors as any)
      throw new Error('Template could not compile')
    }

    return compiledMjMl.html
  }

  async sendEmailFromTemplate({
    template,
    to,
    subject,
    attachments,
    archive
  }: SendEmailFromTemplateParams): Promise<SendGridEmailResponse> {
    if (!this.shouldSendEmail) {
      return {
        isSuccess: true,
        statusCode: 1,
        body: 'Email not sent. No emails are sent in test mode',
        headers: {}
      }
    }

    const mjml = await this.compileTemplate(template)
    const html = this.compileMjml(mjml)

    const bcc: EmailAddress[] = []
    if (archive && this.emailArchive?.length) {
      bcc.push({
        email: this.emailArchive
      })
    }

    // This will not work if we are running in other environments (AWS/AZURE) check before using any other env
    const isRunningInGCP =
      // Linux container
      !!(
        process.platform === 'linux' &&
        // Cloud run
        (process.env.K_SERVICE ??
          // Cloud run job
          process.env.CLOUD_RUN_JOB)
      )

    // Avoid sending emails to real users in dev, test and local prod
    // Prod emails will only go out from linux and (GCP or CIRCLECI)
    const shouldSendEmailToRealUser =
      to.endsWith(`@${this.baseDomain}`) ||
      (this.shouldSendEmail && isRunningInGCP)

    // Exit if we are testing emails and TEST_EMAIL_ADDRESS is not set
    if (!process.env.TEST_EMAIL_ADDRESS && !shouldSendEmailToRealUser) {
      console.log('Email not sent. TEST_EMAIL_ADDRESS env variable is missing')
      return {
        isSuccess: false,
        statusCode: 1,
        body: 'Email not sent. TEST_EMAIL_ADDRESS env variable is missing',
        headers: {}
      }
    }

    const recipient = shouldSendEmailToRealUser
      ? {
          email: to
        }
      : {
          email: process.env.TEST_EMAIL_ADDRESS || ''
        }

    if (!this.emailTransport) {
      throw new Error('No email transport (Sendgrid) defined')
    }

    return await this.emailTransport?.sendFinalizedEmail({
      html,
      fromEmail: `info@${this.baseDomain}`,
      fromName: Strings.capitalize(this.fromName),
      subject,
      replyTo: `no_reply@${this.baseDomain}`,
      recipients: [recipient],
      attachments,
      categories: template.categories,
      bcc
    })
  }

  async sendEmailTemplateTest(
    email: EmailTest
  ): Promise<SendGridEmailResponse> {
    const html = this.compileMjml(email.mjml)

    const [username, domain] = email.to.split('@')

    // Emails will only go out to domain accounts
    if (domain && domain !== this.baseDomain) {
      throw new Error(`Cannot send emails to ${domain} accounts`)
    }

    if (!this.emailTransport) {
      throw new Error('No email transport (Sendgrid) defined')
    }

    return await this.emailTransport?.sendFinalizedEmail({
      html,
      fromEmail: `info@${this.baseDomain}`,
      fromName: Strings.capitalize(this.fromName),
      subject: email.subject,
      replyTo: `no_reply@${this.baseDomain}`,
      recipients: [
        {
          email: `${username}@${this.baseDomain}`
        }
      ],
      categories: [EmailCategory.TEST_EMAIL]
    })
  }
}
