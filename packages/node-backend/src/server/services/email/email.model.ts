import { z } from 'zod'

// export const themeVariables = {
//   [Theme.Gealium]: {
//     logo: `https://www.${env.BASE_DOMAIN}/assets/images/logo-wide-black.png`,
//     logoLink: `https://www.${env.BASE_DOMAIN}/`,
//     primaryColor: '#4db7a3',
//     buttonTextColor: '#ffffff',
//     privacyPolicyLink: 'https://www.gealium.com/about/privacy',
//     unsubscribeLink: 'https://www.gealium.com',
//     facebook: 'Gealium',
//     instagram: 'gealium_com',
//     twitter: 'https://www.gealium.com',
//     appName: 'Gealium',
//   },
//   [Theme.Agrosocial]: {
//     logo: `https://storage.googleapis.com/public-agrosocial-prod/assets/AGSemailcode.png`,
//     logoLink: `https://www.${env.BASE_DOMAIN}/`,
//     primaryColor: '#4db7a3',
//     buttonTextColor: '#ffffff',
//     privacyPolicyLink: 'https://www.agrosocial.com/termsandprivacy',
//     unsubscribeLink: 'https://www.agrosocial.com',
//     facebook: 'agrosocial',
//     instagram: 'agrosocial',
//     twitter: 'https://www.agrosocial.com',
//     appName: 'AgroSocial',
//   },
// }

// export const getThemeFromEnv = (): Theme => {
//   if (env.APP_NAME.toLowerCase() === 'agrosocial') {
//     return Theme.Agrosocial
//   }

//   return Theme.Gealium
// }

export enum EmailCategory {
  SIMPLE = 'SIMPLE',
  TEST_EMAIL = 'TEST_EMAIL',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  SEND_ONCE = 'SEND_ONCE',
  OTP = 'OTP',
  MEETING = 'MEETING',
  ORGANIZATION_INVITATION = 'ORGANIZATION_INVITATION',
  PDF_EXAM = 'PDF_EXAM'
}

export interface EmailAddress {
  email: string
  name?: string
}

export interface EmailTest {
  to: string
  subject: string
  mjml: string
}

export const testEmailTemplate = z.object({
  to: z.string(),
  subject: z.string(),
  mjml: z.string()
})

// Important! user { KEY: string | undefined } and NOT { KEY?: string } on the placeholders.
// All keys are required to exist or the request becomes invalid.

// https://docs.optimove.com/api-usage-guide/#Transactional_Mail_Functions
export interface EmailAttachment {
  Content: string // Base64 encoded
  Type: string
  FileName: string
}
export enum Layout {
  default = 'layouts/default.ejs'
}

export enum Content {
  simple = 'simple/simple.ejs',
  doubleAction = 'doubleAction/doubleAction.ejs'
}

export type Theme = {
  logo: string
  logoLink: string
  primaryColor: string
  buttonTextColor: string
  privacyPolicyLink: string
  unsubscribeLink: string
  facebook: string
  instagram: string
  twitter: string
  appName: string
}

export interface EmailVerificationResp {
  res?: boolean
  suggestion?: string
}

interface SimpleTemplate {
  layout: Layout.default
  content: Content.simple
  categories: [EmailCategory.SIMPLE | EmailCategory.OTP | EmailCategory.MEETING]
  theme?: Theme
  placeholders: {
    title?: string
    imgSrc?: string
    imgAlt?: string
    greeting: string
    body: string
    footer: string
  }
}

export type EmailTemplates = SimpleTemplate

export interface SendEmailFromTemplateParams {
  template: EmailTemplates
  to: string
  subject: string
  attachments?: EmailAttachment[]
  archive?: boolean
}
