import { prisma } from '../prismaClient';
import { randomBytes } from 'crypto';

interface LoginToken {
  loginToken: string;
  loginTokenExpirationAt: string;
}

interface RefreshToken {
  refreshToken: string;
  refreshTokenExpirationAt: string;
}

export async function createLoginToken(): Promise<LoginToken> {
  let loginToken = randomBytes(48).toString('base64').substring(0, 48);
  while (await prisma.user.findUnique({ where: { loginToken: loginToken } })) {
    console.log('トークンが他と被ってるため再生成');
    loginToken = randomBytes(48).toString('base64').substring(0, 48);
  }

  const after30Minutes = new Date(
    new Date().setMinutes(new Date().getMinutes() + 30)
  );

  return {
    loginToken: loginToken,
    loginTokenExpirationAt: after30Minutes.toISOString(),
  };
}

export async function createRefreshToken(): Promise<RefreshToken> {
  let refreshToken = randomBytes(48).toString('base64').substring(0, 48);
  while (
    await prisma.user.findUnique({ where: { refreshToken: refreshToken } })
  ) {
    console.log('トークンが他と被ってるため再生成');
    refreshToken = randomBytes(48).toString('base64').substring(0, 48);
  }

  const after6Months = new Date(
    new Date().setMonth(new Date().getMonth() + 30)
  );

  return {
    refreshToken: refreshToken,
    refreshTokenExpirationAt: after6Months.toISOString(),
  };
}
