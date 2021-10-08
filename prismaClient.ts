import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

export const prisma = (() => {
  console.log(process.env.DATABASE_URL);

  if (!process.env.DATABASE_URL) {
    throw Error('DBのURLがうまく設定できてない');
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
      },
    },
  });
})();
