import { Prisma as PrismaTypes } from '.prisma/client';
import crypto from 'crypto';
import ExtensibleCustomError from 'extensible-custom-error';
import { prisma } from '../prismaClient';
import { Post } from './post';
import { User } from './user';

export class Room {
  /**
   * DB上に部屋データを作成し、Roomを返す
   * @param roomName 作成したい部屋の名前
   * @param author 作成者
   * @returns prismaの作成結果
   */
  static async create(roomName: string, author: User) {
    const passChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';

    const invitePassword = Array.from(
      crypto.randomFillSync(new Uint32Array(32))
    )
      .map((n) => passChars[n % passChars.length])
      .join('');

    const createResult = await prisma.room.create({
      data: {
        name: roomName,
        invitePassword: invitePassword,
        joinedUsers: {
          connect: {
            email: author.email,
          },
        },
      },
      include: {
        joinedUsers: true,
      },
    });

    const users = await Promise.all(
      createResult.joinedUsers.map(async (e) => {
        const user = await User.findUserById(e.id);

        if (user == null) {
          throw new Error('部屋作成時にユーザーが取得できない');
        }

        return user;
      })
    );

    return new Room({ ...createResult, joinedUsers: users });
  }

  /**
   * 部屋に入室して[Room]オブジェクトを返す
   *
   * @param userId 入室したいユーザーのID
   * @param roomId ターゲットの部屋
   * @param invitePassword ターゲットの部屋に設定されている招待パスワード
   * @returns Roomオブジェクト
   */
  static async joinRoom(
    userId: string,
    roomId: string,
    invitePassword: string
  ): Promise<Room | null> {
    const user = await User.findUserById(userId);

    if (!user) {
      return null;
    }

    const room = await prisma.room.findUnique({
      where: {
        id: roomId,
      },
    });

    if (!room || room.invitePassword != invitePassword) {
      return null;
    }

    const queryResult = await prisma.room.update({
      where: {
        id: room.id,
      },
      data: {
        joinedUsers: {
          connect: {
            email: user.email,
          },
        },
      },
      include: {
        joinedUsers: {
          select: {
            id: true,
          },
        },
      },
    });

    const users = await Promise.all(
      queryResult.joinedUsers.map(async (e) => {
        const user = await User.findUserById(e.id);

        if (user == null) {
          throw new Error('部屋作成時にユーザーが取得できない');
        }

        return user;
      })
    );

    return new Room({ ...queryResult, joinedUsers: users });
  }

  static async findRoomById(roomId: string) {
    const findResult = await prisma.room.findUnique({
      where: {
        id: roomId,
      },
      include: {
        joinedUsers: {
          select: { id: true },
        },
      },
    });

    if (!findResult) {
      throw new RoomNotFoundError();
    }

    const joinedUsers = await Promise.all(
      findResult.joinedUsers.map(async (e) => {
        const user = await User.findUserById(e.id);

        if (user == null) {
          throw new Error('部屋作成時にユーザーが取得できない');
        }

        return user;
      })
    );

    return new Room({ ...findResult, joinedUsers });
  }

  /** ルームID */
  id: string;

  /** 部屋名 */
  name: string;

  /** 作成日時 */
  createdAt: Date;

  /** 更新日時 */
  updatedAt: Date;

  /** このオブジェクト作成時点で参加しているユーザーのリスト */
  joinedUsers: User[];

  /** 部屋招待時に必要になるパスワード */
  invitePassword: string;

  constructor(
    roomArgs: PrismaTypes.RoomUncheckedCreateInput & {
      joinedUsers: User[];
    }
  ) {
    if (
      !roomArgs.createdAt ||
      !roomArgs.updateAt ||
      !roomArgs.id ||
      !roomArgs.joinedUsers ||
      !roomArgs.invitePassword
    ) {
      throw new Error('Roomのコンストラクタにundefinedが入っている');
    }

    this.id = roomArgs.id;

    this.name = roomArgs.name;

    const dateNomalize = (date: Date | string): Date =>
      typeof date == 'string' ? new Date(date) : date;

    this.createdAt = dateNomalize(roomArgs.createdAt);

    this.updatedAt = dateNomalize(roomArgs.updateAt);

    this.joinedUsers = roomArgs.joinedUsers;

    this.invitePassword = roomArgs.invitePassword;
  }

  /**
   * 部屋のポストを作成するメソッド
   * [post]が空だったらEmptyTextPostErrorを投げる
   *
   * @param post 作成したい内容Postオブジェクト
   * @returns ポストID
   */
  async createNewPost(post: Post) {
    if (post.isEmptyText) {
      throw new EmptyTextPostError('空のテキストをポストすることはできない');
    }

    const createdPost = await prisma.post.create({
      data: {
        roomId: this.id,
        authorId: post.author.id,
        text: post.text,
      },
    });

    return createdPost.id;
  }

  /**
   * 現時点でのこの部屋のすべての投稿を返す
   *
   * @returns 現時点でのこの部屋のすべての投稿
   */
  async fetchAllPosts() {
    const allPosts = await prisma.room.findUnique({
      where: {
        id: this.id,
      },
      include: {
        posts: true,
      },
    });

    if (!allPosts) {
      throw new RoomNotFoundError();
    }

    return allPosts.posts;
  }

  async exit(user: User) {
    const userDisconnectResult = await prisma.room.update({
      where: {
        id: this.id,
      },
      data: {
        joinedUsers: {
          disconnect: {
            email: user.email,
          },
        },
      },
      include: {
        joinedUsers: {
          select: {
            id: true,
          },
        },
      },
    });

    const newJoinedUsers = await Promise.all(
      userDisconnectResult.joinedUsers.map(async (e) => {
        const user = await User.findUserById(e.id);
        if (!user) {
          throw Error('ユーザーが取得できない');
        }
        return user;
      })
    );

    this.joinedUsers = newJoinedUsers;
  }
}

export class EmptyTextPostError extends ExtensibleCustomError {}

export class RoomNotFoundError extends ExtensibleCustomError {}
