import { Ips } from '@goatlab/node-utils'
import type { Environment } from '../../types/Envinronment'

interface UrlServiceProps {
  isMobile?: boolean
  useIP?: boolean
  preferPublicIp?: boolean
}

export type PaymentSuccessRedirectURL =
  `${string}/payment/processed?orderId=${string}`
export type PaymentFailedRedirectURL =
  `${string}/payment/cancelled?paymentFailed=true&orderId=${string}`
export type PaymentCancelledRedirectURL =
  `${string}/payment/cancelled?orderId=${string}`

const localIpAddress = Ips.getLocalIpAddress()

export class UrlService {
  publicBucketName: string
  privateBucketName: string
  baseDomain: string
  backendApiBaseUrl: string
  environment: Environment

  constructor({
    publicBucketName,
    privateBucketName,
    baseDomain,
    backendApiBaseUrl,
    environment,
  }: {
    publicBucketName: string
    privateBucketName: string
    baseDomain: string
    backendApiBaseUrl: string
    environment: Environment
  }) {
    this.publicBucketName = publicBucketName
    this.privateBucketName = privateBucketName
    this.baseDomain = baseDomain
    this.backendApiBaseUrl = backendApiBaseUrl
    this.environment = environment
  }
  public getBackendUrl = (
    { isMobile, useIP }: UrlServiceProps = { isMobile: false, useIP: false },
  ) => {
    if (this.environment === 'local') {
      return this.backendApiBaseUrl
    }

    if (isMobile || useIP) {
      return `http://${localIpAddress}:8086`
    }

    return `https://api.a.getsodium.com`
  }

  /**
   * When running locally, the storage can be accessed
   * either using localhost, the localIp of the host or Nginx URL
   *
   * We mainly use this for local testing as Chrome forces us to have
   * an HTTPS endpoint to upload assets to the Firebase Emulator
   * @returns
   */
  public getLocalStorageHostUrl = async ({
    isMobile,
    useIP,
  }: UrlServiceProps): Promise<string> => {
    if (isMobile || useIP) {
      return `http://${localIpAddress}:9199`
    }
    return `https://assets.a.getsodium.com`
  }

  public getPublicStorageUrl = async ({ isMobile, useIP }: UrlServiceProps) => {
    if (this.environment === 'local') {
      const storageServiceUrl = await this.getLocalStorageHostUrl({
        isMobile,
        useIP,
      })

      return `${storageServiceUrl}/${this.publicBucketName}`
    }

    if (this.environment === 'prod') {
      return `https://assets.${this.baseDomain}`
    }

    return `https://assets-dev.${this.baseDomain}`
  }

  public getPrivateStorageUrl = async ({
    isMobile,
    useIP,
  }: UrlServiceProps) => {
    if (this.environment === 'local') {
      const storageServiceUrl = await this.getLocalStorageHostUrl({
        isMobile,
        useIP,
      })

      return `${storageServiceUrl}/${this.privateBucketName}`
    }

    if (this.environment === 'prod') {
      return `https://private-assets.${this.baseDomain}`
    }

    return `https://private-assets-dev.${this.baseDomain}`
  }

  public getFrontendUrl = () => {
    if (this.environment === 'local') {
      return 'https://frontend.a.getsodium.com'
    }

    if (this.environment === 'prod') {
      return `https://dev.${this.baseDomain}`
    }

    return `https://${this.baseDomain}`
  }

  /**
   * Decides where to send the user back after the payment has been completed
   * if we already decided on an origin, it will use that origin
   *
   * @param origin
   * @returns
   */
  public getFrontendRedirectURL(origin?: string) {
    // This is the frontend url
    const baseRedirect =
      origin ||
      // Just in case origin is not provided (should not happen)
      (this.environment === 'prod'
        ? `https://${this.baseDomain}`
        : // DEV running in cloud run
          this.environment === 'dev' && process.env.K_SERVICE
          ? `https://dev.${this.baseDomain}`
          : 'https://localhost:4430')

    return baseRedirect
  }

  /**
   * Decides which backend the payment provider should reply to
   * It can be either dev, prod or local. Transbank queries the backend from
   * the frontend, so you will still be able to use local urls
   * @param origin
   * @returns
   */
  public getBackendRedirectURLForTransBankPayments({
    origin,
    orderId,
    storeId,
  }: {
    origin?: string
    orderId?: string
    storeId?: string
  }) {
    const redirectUrl = this.getBackendUrl({
      useIP: true,
      preferPublicIp: true,
    })

    return `${redirectUrl}/payments/process?origin=${origin}&storeId=${storeId}&orderId=${orderId}`
  }

  /**
   * Redirección de pago exitoso
   * @param origin
   * @param orderId
   */
  public getPaymentSuccessRedirectURL(
    origin: string | undefined,
    orderId: string,
  ): PaymentSuccessRedirectURL {
    const base = this.getFrontendRedirectURL(origin)
    return `${base}/payment/processed?orderId=${encodeURIComponent(orderId)}`
  }

  /**
   * Redirección de pago con error (fallo en commit, etc)
   * @param origin
   * @param orderId
   */
  public getPaymentFailedRedirectURL(
    origin: string | undefined,
    orderId: string,
  ): PaymentFailedRedirectURL {
    const base = this.getFrontendRedirectURL(origin)
    return `${base}/payment/cancelled?paymentFailed=true&orderId=${encodeURIComponent(orderId)}`
  }

  /**
   * Redirección de pago cancelado por el usuario
   * @param origin
   * @param orderId
   */
  public getPaymentCancelledRedirectURL(
    origin: string | undefined,
    orderId: string,
  ): PaymentCancelledRedirectURL {
    const base = this.getFrontendRedirectURL(origin)
    return `${base}/payment/cancelled?orderId=${encodeURIComponent(orderId)}`
  }
}
