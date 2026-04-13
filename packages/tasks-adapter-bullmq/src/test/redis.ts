import { RedisContainer } from '@testcontainers/redis'

export const getRedisContainer = () => {
  return new RedisContainer('redis:7-alpine')
}
