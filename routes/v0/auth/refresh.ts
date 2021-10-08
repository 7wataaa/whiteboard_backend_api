import { Request, Response, Router } from 'express';
import {
  createLoginToken,
  createRefreshToken,
} from '../../../model/createToken';
import { prisma } from '../../../prismaClient';

export const router = Router();

router.post(
  '/auth/refresh',
  // 適切なrefreshトークンでなければ弾く
  async (req, res, next) => {
    if (
      !req.headers.authorization ||
      req.headers.authorization.split(' ').length != 2
    ) {
      res.sendStatus(400);
      return;
    }

    const authorizationHeader = {
      type: req.headers.authorization.split(' ')[0],
      token: req.headers.authorization.split(' ')[1],
    };

    if (
      authorizationHeader.type !== 'Bearer' ||
      authorizationHeader.token.length != 48 ||
      !RegExp(/^[\-\~\+\/\w]{48}$/).test(authorizationHeader.token)
    ) {
      res.sendStatus(400);
      return;
    }

    next();
  },
  async (req: Request, res: Response) => {
    const token = req.headers.authorization!.split(' ')[1];
    const user = await prisma.user.findUnique({
      where: {
        refreshToken: token,
      },
    });

    if (!user) {
      res.sendStatus(400);
      return;
    }

    // リフレッシュトークンの有効期限が切れていないか
    if (new Date(user.refreshTokenExpirationAt) <= new Date()) {
      res.sendStatus(400);
      return;
    }

    const loginTokenInfo = await createLoginToken();
    const refreshTokenInfo = await createRefreshToken();

    const refreshedUserTokenInfos = await prisma.user.update({
      where: {
        refreshToken: token,
      },
      data: {
        ...loginTokenInfo,
        ...refreshTokenInfo,
      },
      select: {
        loginToken: true,
        loginTokenExpirationAt: true,
        refreshToken: true,
        refreshTokenExpirationAt: true,
      },
    });

    res.status(200).json({
      ...refreshedUserTokenInfos,
      loginTokenExpirationAt: new Date(
        refreshedUserTokenInfos.loginTokenExpirationAt
      ).toISOString(),
      refreshTokenExpirationAt: new Date(
        refreshedUserTokenInfos.refreshTokenExpirationAt
      ).toISOString(),
    });
  }
);
