import { Router, Request, Response } from 'express';
import { prisma } from '../../../prismaClient';
import * as bcrypt from 'bcrypt';
import {
  createLoginToken,
  createRefreshToken,
} from '../../../model/createToken';

export const router = Router();

/**
@swagger
 *  /api/v0/auth/register:
 *    post:
 *      description: It receive email and password, then create the user's data in the DB. Finally, returns loginToken, refreshToken, and thier expiration dates.
 *      parameters:
 *        - name: email and password
 *          in: body
 *          schema:
 *            type: object
 *            properties:
 *              email:
 *                type: string
 *                format: email
 *                example: mail@example.com
 *              password:
 *                type: string
 *                format: password
 *                example: paIjfEa123oafJo
 *      responses:
 *        200:
 *          description: 
 *              The registration process completed unsuccessfully. It return the LoginToken and RefreshToken and thier expiration dates.
 *          schema:
 *            type: object
 *            properties:
 *              loginToken:
 *                type: string
 *                description: A 48-character string to used log in.
 *                example: OlYZVpqN8l9pQs2iyHLPaF93cgwJ8XUVeSRdPpsuBNbLRpuw
 *              loginTokenExpirationDate:
 *                type: string
 *                description: Expiration date of LoginToken in ISO format.
 *              refreshToken:
 *                type: string
 *                description: A 48-character string to used LoginToken.
 *        409:
 *          description:
 *            The registration process completed fail. Already exists user.
 *        500:
 *          description:
 *            The registration process completed fail. The parameters are correct, but a server-side error has occurred.
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
    res.status(500);
    res.json({
      errorMassage: '何らかの理由でユーザーが作成できなかった',
    });
  }
});
