import { PrismaClient } from '@prisma/client';

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
      password: password,
    },
  });

  return createResult;
}

export { createUser };
