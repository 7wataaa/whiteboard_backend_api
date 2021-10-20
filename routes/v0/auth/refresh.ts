import { Request, Response, Router } from 'express';
import { User } from '../../../model/user';

export const router = Router();

/**
 * @swagger
 * /api/v0/auth/refresh:
 *  post:
 *    description: >-
 *      Receive a refresh token, and update the user's refreshToken and
 *      loginToken, and returns them.
 *    parameters:
 *      - name: Authorization
 *        in: header
 *        required: true
 *        type: string
 *    responses:
 *      '200':
 *        description: Successful processing.
 *        schema:
 *          type: object
 *          properties:
 *            loginToken:
 *              type: string
 *              format: email
 *              description: accsess_token.
 *              example: OlYZVpqN8l9pQs2iyHLPaF93cgwJ8XUVeSRdPpsuBNbLRpuw
 *            loginTokenExpirationAt:
 *              type: string
 *              format: uuid
 *              description: Access token expiration date. ISO format.
 *              example: '2022-04-08T12:26:58.981Z'
 *            refreshToken:
 *              type: string
 *              format: email
 *              description: refresh_token.
 *              example: OlYZVpqN8l9pQs2iyHLPaF93cgwJ8XUVeSRdPpsuBNbLRpuw
 *            refreshTokenExpirationAt:
 *              type: string
 *              format: uuid
 *              description: Refresh token expiration date. ISO format.
 *              example: '2022-04-08T12:26:58.981Z'
 *      '400':
 *        description: Processing failure.
 */
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
    const user = await User.findUserByRefreshToken(token);

    if (!user || !user.validToken) {
      res.sendStatus(400);
      return;
    }

    const newUser = await User.regenerateUsersToken(
      user.validToken.refreshToken
    );

    if (!newUser) {
      res.sendStatus(500);
      return;
    }

    res.status(200).json({
      createdAt: newUser.validToken!.createdAt.toISOString(),
      loginToken: newUser.validToken!.loginToken,
      refreshToken: newUser.validToken!.refreshToken,
    });
  }
);
