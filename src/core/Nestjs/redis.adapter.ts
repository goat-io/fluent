import { IoAdapter } from '@nestjs/platform-socket.io'
import { RedisClient } from 'redis'
import { createAdapter } from 'socket.io-redis'

const pubClient = new RedisClient({
  host: process.env.REDIS_HOST || 'localhost',
  // tslint:disable-next-line: radix
  port: parseInt(process.env.REDIS_POR) || 6379
})
const subClient = pubClient.duplicate()

const redisAdapter = createAdapter({
  pubClient,
  subClient
})

export class RedisIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: object): object {
    const server = super.createIOServer(port, options)
    server.adapter(redisAdapter)
    return server
  }
}
