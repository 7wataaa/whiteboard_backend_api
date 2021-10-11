import { User } from '.prisma/client';
import { Request, Response, Router } from 'express';
import passport from 'passport';

export const router = Router();

/**
 * @swagger
 *  /api/v0/users/me:
 *    get:
 *      description: Return the information of the owner of loginToken.
 *      parameters:
 *      - in: header
 *        name: Authorization
 *        type: string
 *        required: true
 *      responses:
 *        200:
 *          description: Return Token owner's information.
 *          schema:
 *            type: object
 *            properties:
 *              id:
 *                type: string
 *                format: uuid
 *              username:
 *                type: string
 *                description: loginToken owner's username
 *              email:
 *               type: string
 *               description: loginToken owner's email
 *        401:
 *          description: Unauthorized
 */
router.get(
  '/users/me',
  passport.authenticate('bearer', { session: false }),
  async (req: Request, res: Response) => {
    const isUser = (user: any): user is User => user.id != null;

    if (!isUser(req.user)) {
      res.sendStatus(500);
      return;
    }

    res.status(200).json({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
    });
  }
);
