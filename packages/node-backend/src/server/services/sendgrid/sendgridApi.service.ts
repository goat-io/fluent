import { Http, KyInstance } from '@goatlab/js-utils'
import type {
  MailJSON,
  SendGridEmailResponse,
  SendgridHTMLEmailRequest,
} from './sendgrid.model'

export class SendgridService {
  sendgridApi: KyInstance | undefined = undefined
  shouldSendEmail: boolean = true
  fromEmail: string = 'test@example.com'

  constructor({
    token,
    shouldSendEmail = true,
    fromEmail,
  }: {
    token: string
    shouldSendEmail?: boolean
    fromEmail: string
  }) {
    this.sendgridApi = Http.getClient({
      prefixUrl: 'https://api.sendgrid.com/v3/',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      retry: {
        limit: 3,
        // Sendgrid uses POST
        methods: ['POST'],
      },
    })

    this.shouldSendEmail = shouldSendEmail
    this.fromEmail = fromEmail
  }

  // https://docs.sendgrid.com/api-reference/mail-send/mail-send
  async sendFinalizedEmail(
    request: SendgridHTMLEmailRequest,
  ): Promise<SendGridEmailResponse> {
    if (!this.shouldSendEmail) {
      console.log('NOT SENDING EMAILS - shouldSendEmail=false')
      return {
        isSuccess: false,
        statusCode: 1,
        body: {},
        headers: {},
      }
    }

    const json: MailJSON = {
      personalizations: [
        {
          to: request.recipients,
          bcc: request.bcc?.length ? request.bcc : undefined,
        },
      ],
      subject: request.subject,
      categories: request.categories,
      content: [{ type: 'text/html', value: request.html }],
      from: {
        email: this.fromEmail,
        name: request.fromName,
      },
      reply_to: { email: request.replyTo },
      tracking_settings: {
        click_tracking: {
          enable: true,
          enable_text: true,
        },
        open_tracking: {
          enable: true,
        },
      },
      attachments: request.attachments?.length
        ? request.attachments
        : undefined,
    }

    if (!this.sendgridApi) {
      return {
        isSuccess: false,
        statusCode: 1,
        body: {},
        headers: {},
      }
    }

    return await this.sendgridApi
      .post('mail/send', {
        json,
      })
      .json<SendGridEmailResponse>()
  }
}
