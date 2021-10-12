import { User } from '.prisma/client';
import { prisma } from '../prismaClient';

export async function createRoom(name: string, author: User) {
  return await prisma.room.create({
    data: {
      name: name,
      joinedUsers: {
        connect: {
          email: author.email,
        },
      },
    },
  });
}
