import { User } from '.prisma/client';
import { Request, Response, Router } from 'express';
import passport from 'passport';
import { createRoom } from '../../../model/createRoom';

export const router = Router();

/**
 *  @swagger
 *  /api/v0/rooms/create:
 *    post:
 *      description: Create new room data in DB, and return roomId, name and createdAt. This creator will be joined to the created room data.
 *      parameters:
 *      - in: header
 *        name: Authorization
 *        type: string
 *        required: true
 *      - in: body
 *        name: room name
 *        schema:
 *          type: object
 *          properties:
 *            name:
 *              type: string
 *      responses:
 *        200:
 *          description: Create new room data in DB, and return roomId, name and createdAt.
 *          schema:
 *            type: object
 *            properties:
 *              roomId:
 *                type: string
 *                format: uuid
 *              name:
 *                type: string
 *              createdAt:
 *                type: string
 *                format: date-time
 *
 */
router.post(
  '/rooms/create',
  passport.authenticate('bearer', { session: false }),
  async (req: Request, res: Response) => {
    const isUser = (user: any): user is User => user.id != null;

    if (!isUser(req.user) || !req.user) {
      res.sendStatus(500);
      return;
    }

    const roomname = req.body['name'];

    if (typeof roomname !== 'string' || roomname.length == 0) {
      res.sendStatus(400);
      return;
    }

    const room = await createRoom(roomname, req.user);

    res.status(200).json({
      roomId: room.id,
      name: room.name,
      createdAt: room.createdAt.toISOString(),
    });
  }
);
