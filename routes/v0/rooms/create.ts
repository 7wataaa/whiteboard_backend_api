import { User } from '.prisma/client';
import { Request, Response, Router } from 'express';
import passport from 'passport';
import { createRoom } from '../../../model/createRoom';

export const router = Router();

router.post(
  '/rooms/create',
  passport.authenticate('bearer', { session: false }),
  async (req: Request, res: Response) => {
    const isUser = (user: any): user is User => user.id != null;

    if (!isUser(req.user)) {
      res.sendStatus(500);
      return;
    }

    const roomname = req.body['name'];

    if (typeof roomname !== 'string' || roomname.length == 0) {
      res.sendStatus(400);
      return;
    }

    const room = await createRoom(roomname);

    res.status(200).json({
      roomId: room.id,
      name: room.name,
      createdAt: room.createdAt.toISOString(),
    });
  }
);
