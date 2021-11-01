import { PrismaClientUnknownRequestError } from '@prisma/client/runtime';
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

const roomIdRegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isUser = (user: any): user is User =>
  user.id != null && user.createdAt != null;

router
  .post(
    // 投稿の新規作成
    '/rooms/:roomId/posts',
    passport.authenticate('bearer', { session: false }),
    async (req: Request, res: Response) => {
      // パラメーターが正常かの判定と、Roomの取得

      if (!isUser(req.user)) {
        res.sendStatus(500);
        return;
      }

      const roomId = req.params['roomId'];

      if (
        !roomId ||
        ![32, 36].includes(roomId.length) ||
        !roomIdRegExp.test(roomId)
      ) {
        res.sendStatus(400);
        return;
      }

      const room = await Room.findRoomById(roomId).catch((e) => {
        if (e instanceof RoomNotFoundError) {
          return null;
        } else if (e instanceof PrismaClientUnknownRequestError) {
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

      // パラメーターが正常なので投稿を作成

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
  )
  .get(
    // この部屋の投稿を取得
    '/rooms/:roomId/posts',
    passport.authenticate('bearer', { session: false }),
    async (req: Request, res: Response) => {
      // パラメーターが正常かの判定と、Roomの取得

      if (!isUser(req.user)) {
        res.sendStatus(500);
        return;
      }

      const roomId = req.params['roomId'];

      if (
        !roomId ||
        ![32, 36].includes(roomId.length) ||
        !roomIdRegExp.test(roomId)
      ) {
        res.sendStatus(400);
        return;
      }

      const room = await Room.findRoomById(roomId).catch((e) => {
        if (e instanceof RoomNotFoundError) {
          return null;
        } else if (e instanceof PrismaClientUnknownRequestError) {
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

      // パラメーターが正常なので投稿一覧を返す

      const posts = await room.fetchAllPosts().catch((e) => {
        if (e instanceof RoomNotFoundError) {
          return null;
        } else {
          throw e;
        }
      });

      if (!posts) {
        res.sendStatus(400);
        return;
      }

      res.status(200).json({
        posts: posts,
      });
    }
  );
