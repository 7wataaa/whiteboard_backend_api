import { PrismaClient, User } from '.prisma/client';

export const deleteUser = async (
  prisma: PrismaClient,
  targetEmail: string
): Promise<User> => {
  return await prisma.user.delete({
    where: {
      email: targetEmail,
    },
  });
};
