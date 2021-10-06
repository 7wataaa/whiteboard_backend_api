import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

export const prisma = (() => {
  console.log(process.env.TEST_DATABASE_URL);
  console.log(process.env.DATABASE_URL);

  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
      },
    },
  });
})();
