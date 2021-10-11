import { prisma } from '../prismaClient';

export async function createRoom(name: string) {
  return await prisma.room.create({
    data: {
      name: name,
    },
  });
}
