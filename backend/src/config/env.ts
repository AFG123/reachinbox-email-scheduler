import 'dotenv/config';
import { logger } from '../utils/logger';

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

/**
 * Validates critical environment variables on startup.
 * Throws an error and exits the process if any variables are missing.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const name of REQUIRED_ENV_VARS) {
    if (!process.env[name] || process.env[name]?.trim() === '') {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    logger.error('==================================================');
    logger.error('🔴 CRITICAL STARTUP ERROR: Missing Environment Config');
    logger.error('==================================================');
    missing.forEach((name) => {
      logger.error(`❌ Missing Variable: ${name}`);
    });
    logger.error('Please configure these keys in your local .env or Render dashboard.');
    logger.error('==================================================\n');
    process.exit(1);
  }

  logger.info('⚙️ Environment variables validated successfully.');
}
