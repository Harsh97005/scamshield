import 'dotenv/config';
import { z } from 'zod';

/**
 * Schema for all environment variables required by the application.
 * Validation fails fast on startup if anything is missing or malformed —
 * the process should never boot with an invalid/incomplete configuration.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z
    .string()
    .default('5000')
    .transform((val) => Number(val))
    .pipe(z.number().int().positive()),

  API_VERSION: z.string().min(1).default('v1'),

  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .startsWith('mongodb', 'MONGODB_URI must be a valid MongoDB connection string'),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1, 'CORS_ALLOWED_ORIGINS is required')
    .transform((val) => val.split(',').map((origin) => origin.trim())),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
});

/**
 * Parse and validate process.env against the schema.
 * Throws synchronously on failure — caught once, here, with a readable
 * summary instead of letting a malformed config surface as a confusing
 * runtime error deeper in the app.
 */
function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${formatted}`);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
