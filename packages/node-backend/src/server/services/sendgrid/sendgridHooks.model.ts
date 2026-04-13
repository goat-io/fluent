import type { EmailCategory } from '../email/email.model'

export enum SendgridEventType {
  // Process events
  processed = 'processed',
  dropped = 'dropped',

  // Deliver events
  bounce = 'bounce',
  deferred = 'deferred',
  delivered = 'delivered',

  // Read events
  open = 'open',
  click = 'click',
  unsubscribe = 'unsubscribe',
  spamreport = 'spamreport',
}

export interface SendgridEvent {
  email: string
  category?: EmailCategory[]
  'smtp-id'?: string
  sg_event_id: string
  sg_message_id?: string
  timestamp: number
  event: SendgridEventType
  ip?: string
  url?: string
  useragent?: string
  response?: string
  reason?: string
  status?: string
}
