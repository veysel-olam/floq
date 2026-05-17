import { createClient, type RedisClientType } from 'redis'
import { env } from './env.js'

export const redis: RedisClientType = createClient({ url: env.REDIS_URL }) as RedisClientType

redis.on('error', (err: unknown) => console.error('Redis error:', err))

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect()
}
