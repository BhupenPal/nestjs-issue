import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),

  ONDC_REGISTRY_URL: z.string().url(),
  ONDC_REGISTRY_PUBLIC_KEY: z.string(),

  REDIS_URL: z.string().url(),

  RABBITMQ_URL: z.string().url(),

  MONGO_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export const validateConfig = (config: Record<string, unknown>) => {
  const result = envSchema.parse(config);
  return result;
};
