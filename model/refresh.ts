import { prisma } from '../prismaClient';
import {
  createLoginToken,
  createRefreshToken,
  LoginToken,
  RefreshToken,
} from './createToken';

export async function refresh(
  refreshToken: string
): Promise<(LoginToken & RefreshToken) | null> {
  const user = await prisma.user.findUnique({
    where: {
      refreshToken: refreshToken,
    },
    select: {
      loginToken: true,
      refreshToken: true,
    },
  });

  if (!user) {
    return null;
  }

  const { loginToken: newLoginToken, loginTokenExpirationAt } =
    await (async () => {
      let newLoginTokens = await createLoginToken();

      while (newLoginTokens.loginToken === user.loginToken) {
        newLoginTokens = await createLoginToken();
      }

      return newLoginTokens;
    })();

  const { refreshToken: newRefreshToken, refreshTokenExpirationAt } =
    await (async () => {
      let newRefreshTokens = await createRefreshToken();

      while (newRefreshTokens.refreshToken === user.refreshToken) {
        newRefreshTokens = await createRefreshToken();
      }

      return newRefreshTokens;
    })();

  const updatedUser = await prisma.user.update({
    where: {
      refreshToken: refreshToken,
    },
    data: {
      loginToken: newLoginToken,
      loginTokenExpirationAt: loginTokenExpirationAt,
      refreshToken: newRefreshToken,
      refreshTokenExpirationAt: refreshTokenExpirationAt,
    },
    select: {
      loginToken: true,
      loginTokenExpirationAt: true,
      refreshToken: true,
      refreshTokenExpirationAt: true,
    },
  });

  return {
    ...updatedUser,
    // 期限切れ日時はISO形式の文字列として返したいのでスプレッド構文を上書きする
    loginTokenExpirationAt: updatedUser.loginTokenExpirationAt.toISOString(),
    refreshTokenExpirationAt:
      updatedUser.refreshTokenExpirationAt.toISOString(),
  };
}
