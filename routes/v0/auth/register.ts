import { Request, Response, Router } from 'express';
import { User } from '../../../model/user';

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

  const aleadyExistsUser = await User.findUserByEmail(email);

  if (aleadyExistsUser) {
    res.status(409);
    res.json({
      code: 409,
      errorMassage: 'このユーザーはすでに登録されています',
    });
    return;
  }

  const newUser = await User.createUserByEmailAndPassword(email, password, '');

  if (newUser) {
    // 本人確認メールの送信
    await newUser.sendConfirmationEmail();

    res.status(200);
    // TODO トークンを返却するときの方法を決める(例: どこかしらのヘッダーに入れるなど)
    res.json({
      loginToken: newUser.validToken?.loginToken,
      refreshToken: newUser.validToken?.refreshToken,
      createdAt: newUser.validToken?.createdAt.toISOString(),
    });
  } else {
    res.status(500);
    res.json({
      errorMassage: '何らかの理由でユーザーが作成できなかった',
    });
  }
});
