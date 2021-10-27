import { Request, Response, Router } from 'express';
import passport from 'passport';
import { Post } from '../../../../../model/post';
import {
  EmptyTextPostError,
  Room,
  RoomNotFoundError,
} from '../../../../../model/room';
import { User } from '../../../../../model/user';

export const router = Router();

// 投稿の新規作成
router.post(
  '/rooms/:roomId/posts',
  passport.authenticate('bearer', { session: false }),
  async (req: Request, res: Response) => {
    const isUser = (user: any): user is User =>
      user.id != null && user.createdAt != null;

    if (!isUser(req.user)) {
      res.sendStatus(500);
      return;
    }

    const roomId = req.params['roomId'];

    console.log(roomId);

    if (!roomId || ![32, 36].includes(roomId.length)) {
      res.sendStatus(400);
      return;
    }

    const room = await Room.findRoomById(roomId).catch((e) => {
      if (e instanceof RoomNotFoundError) {
        return null;
      } else {
        throw e;
      }
    });

    if (!room) {
      res.sendStatus(400);
      return;
    }

    if (!req.user.isInRoom(room)) {
      res.sendStatus(400);
      return;
    }

    const postId = await room
      .createNewPost(new Post({ text: req.body['text'], author: req.user }))
      .catch((e) => {
        if (e instanceof EmptyTextPostError) {
          return null;
        } else {
          throw e;
        }
      });

    if (!postId) {
      res.sendStatus(400);
      return;
    }

    res.status(200).json({
      id: postId,
    });
  }
);
