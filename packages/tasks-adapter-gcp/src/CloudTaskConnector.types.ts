export interface GCPServiceAccount {
  [k: string]: any
  keyFilename: string
  project_id: string
  client_id: string
  client_email: string
  private_key: string
  private_key_id: string
  auth_uri: string
  type: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
}
