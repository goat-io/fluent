import * as fs from 'node:fs'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RedisContainer } from '@testcontainers/redis'
import { VaultContainer } from '@testcontainers/vault'
// This file runs before jest sets the env
// so we need to load dotenv manually if we want to use env

export default async () => {
  const filePath = resolve(__dirname, 'tempData.json')
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  const redisContainer = await new RedisContainer('redis:7.2').start()

  // Vault container with dev mode and test token
  const vaultContainer = await new VaultContainer('hashicorp/vault:1.13')
    .withEnvironment({
      VAULT_DEV_ROOT_TOKEN_ID: 'test-token',
      VAULT_DEV_LISTEN_ADDRESS: '0.0.0.0:8200'
    })
    .withExposedPorts(8200)
    .start()

  const redisUrl = redisContainer.getConnectionUrl()
  const vaultUrl = `http://${vaultContainer.getHost()}:${vaultContainer.getMappedPort(8200)}`

  const data = {
    redisUrl,
    vaultUrl,
    vaultToken: 'test-token'
  }
  writeFileSync(filePath, JSON.stringify(data), 'utf-8')

  return async () => {
    await redisContainer.stop()
    await vaultContainer.stop()

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}
