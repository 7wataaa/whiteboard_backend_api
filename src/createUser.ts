import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createUser({
  username,
  password,
}: {
  username: string;
  password: string;
}) {
  const createResult = await prisma.user.create({
    data: {
      username: username,
      password: hashPassword(password),
    },
  });

  return createResult;
}

function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export { createUser };
