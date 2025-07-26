import type { EmailAddress, EmailAttachment } from '../email/email.model'

export interface SendgridHTMLEmailRequest {
  fromEmail: string
  fromName: string
  replyTo: string
  subject: string
  html: string
  categories: string[]
  recipients: [
    {
      email: string
      name?: string
    },
  ]
  bcc?: EmailAddress[]
  attachments?: EmailAttachment[]
}

// Source: https://github.com/sendgrid/sendgrid-nodejs/blob/main/packages/helpers/classes
export interface SendGridEmailResponse {
  isSuccess: boolean
  statusCode: number
  body: string | Record<string, string>
  headers: Record<string, string>
}

export interface TrackingSettingsJSON {
  click_tracking?: {
    enable?: boolean
    enable_text?: boolean
  }
  open_tracking?: {
    enable?: boolean
    substitution_tag?: string
  }
  subscription_tracking?: {
    enable?: boolean
    text?: string
    html?: string
    substitution_tag?: string
  }
  ganalytics?: {
    enable?: boolean
    utm_source?: string
    utm_medium?: string
    utm_term?: string
    utm_content?: string
    utm_campaign?: string
  }
}

export interface MailSettingsJSON {
  bcc?: {
    enable?: boolean
    email?: string
  }
  bypass_list_management?: {
    enable?: boolean
  }
  footer?: {
    enable?: boolean
    text?: string
    html?: string
  }
  sandbox_mode?: {
    enable?: boolean
  }
  spam_check?: {
    enable?: boolean
    threshold?: number
    post_to_url?: string
  }
}

export interface ASMOptionsJSON {
  group_id: number
  groups_to_display?: number[]
}

export interface MailContent {
  type: string
  value: string
}

export interface AttachmentJSON {
  content: string
  filename: string
  type?: string
  disposition?: string
  content_id?: string
}

export interface EmailJSON {
  name?: string
  email: string
}

export interface PersonalizationJSON {
  to: EmailJSON | EmailJSON[]
  cc?: EmailJSON[]
  bcc?: EmailJSON[]
  headers?: Record<string, string>
  substitutions?: Record<string, string>
  dynamic_template_data?: Record<string, string>
  custom_args?: Record<string, string>
  subject?: string
  send_at?: number
}

export interface MailJSON {
  from: EmailJSON
  subject: string
  content: MailContent[]
  personalizations: PersonalizationJSON[]
  attachments?: AttachmentJSON[] | EmailAttachment[]
  categories?: string[]
  headers?: Record<string, string>
  mail_settings?: MailSettingsJSON
  tracking_settings?: TrackingSettingsJSON
  custom_args?: Record<string, string>
  sections?: Record<string, string>
  asm?: ASMOptionsJSON
  reply_to?: EmailJSON
  send_at?: number
  batch_id?: string
  template_id?: string
  ip_pool_name?: string
}
