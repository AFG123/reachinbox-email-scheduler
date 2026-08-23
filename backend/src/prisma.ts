import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// 1. Initialize the PostgreSQL connection pool using the native 'pg' driver
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Wrap the pool in the PrismaPg adapter
const adapter = new PrismaPg(pool);

// 3. Prevent multiple instances of Prisma Client in development hot-reloads
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;