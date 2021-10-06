import { User } from '.prisma/client';
import { prisma } from '../prismaClient';

export async function login(token: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: {
      loginToken: token,
    },
  });
}
