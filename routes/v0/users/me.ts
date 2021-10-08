import { User } from '.prisma/client';
import { Request, Response, Router } from 'express';
import passport from 'passport';

export const router = Router();

/**
 * @swagger
 * /api/v0/users/me:
 *  get:
 *    description: id, username, emailを返す
 *    responses:
 *      - 200:
 *
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
