import { Router, Request, Response } from 'express';
import { prisma } from '../../../prismaClient';
import * as bcrypt from 'bcrypt';
import {
  createLoginToken,
  createRefreshToken,
} from '../../../model/createToken';

export const router = Router();

/**
 * @swagger
 * /api/v0/auth/register:
 *  get:
 *    description: ユーザーネーム､パスワードをもらってトークンを返す
 *    responses:
 *      - 200:
 *
 */
router.post('/auth/register', async (req: Request, res: Response) => {
  const email = req.body['email'];
  const password = req.body['password'];

  if (email == '' || !email || password == '' || !password) {
    res.sendStatus(400);
    return;
  }

  const aleadyExistsUser = (async () => {
    const users = prisma.user.findMany({
      where: {
        email: email,
      },
      select: {
        id: true,
        hashedPassword: true,
      },
    });

    for (const e of await users) {
      if (bcrypt.compareSync(password, e.hashedPassword)) {
        return await prisma.user.findUnique({
          where: {
            id: e.id,
          },
        });
      }
    }
  })();

  if (await aleadyExistsUser) {
    res.status(409);
    res.json({
      code: 409,
      errorMassage: 'このユーザーはすでに登録されています',
    });
    return;
  }

  const loginToken = createLoginToken();
  const refreshToken = createRefreshToken();

  const newUser = await prisma.user
    .create({
      data: {
        email: email,
        hashedPassword: bcrypt.hashSync(password, 10),
        username: '',
        ...(await loginToken),
        ...(await refreshToken),
      },
    })
    .catch((e) => {
      console.info(e);
      return null;
    });

  if (newUser) {
    res.status(200);
    // TODO トークンを返却するときの方法を決める(例: どこかしらのヘッダーに入れるなど)
    res.json({
      ...(await loginToken),
      ...(await refreshToken),
    });
  } else {
    res.send(500);
    res.json({
      errorMassage: '何らかの理由でユーザーが作成できなかった',
    });
  }
});
