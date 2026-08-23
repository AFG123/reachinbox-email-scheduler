import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    // Extend Passport's User interface with our Prisma User model fields
    interface User extends PrismaUser {}
  }
}
