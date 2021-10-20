import { Request, Response, Router } from 'express';
import passport from 'passport';
import { Room } from '../../../model/room';
import { User } from '../../../model/user';

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
    const isUser = (obj: any): obj is User =>
      obj != null &&
      obj.id != null &&
      obj.email != null &&
      obj.hashedPassword != null;

    const user = req.user ?? null;

    if (!user || !isUser(user)) {
      console.dir(user, { depth: null });
      res.sendStatus(500);
      return;
    }

    const roomName = req.body['name'];

    if (typeof roomName !== 'string' || roomName.length == 0) {
      res.sendStatus(400);
      return;
    }

    const room = await Room.create(roomName, user);

    res.status(200).json({
      roomId: room.id,
      name: room.name,
      createdAt: room.createdAt.toISOString(),
    });
  }
);
