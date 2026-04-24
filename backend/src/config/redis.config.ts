import { ConfigService } from '@nestjs/config';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: number;
}

export const getRedisConfig = (configService: ConfigService): RedisConfig => ({
  host: configService.get<string>('REDIS_HOST', 'localhost'),
  port: configService.get<number>('REDIS_PORT', 6379),
  password: configService.get<string>('REDIS_PASSWORD'),
  db: configService.get<number>('REDIS_DB', 0),
  keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'renaissance:'),
  ttl: configService.get<number>('REDIS_TTL', 3600),
});

export const getRedisCacheStoreConfig = (configService: ConfigService) => ({
  store: 'ioredis',
  host: configService.get<string>('REDIS_HOST', 'localhost'),
  port: configService.get<number>('REDIS_PORT', 6379),
  password: configService.get<string>('REDIS_PASSWORD'),
  db: configService.get<number>('REDIS_DB', 0),
  keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'renaissance:'),
  ttl: configService.get<number>('REDIS_TTL', 3600),
  max: configService.get<number>('REDIS_CACHE_MAX', 1000),
});
