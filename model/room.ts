import { Prisma as PrismaTypes } from '.prisma/client';
import { prisma } from '../prismaClient';
import { User } from './user';

export class Room {
  /**
   * DB上に部屋データを作成し、Roomを返す
   * @param roomName 作成したい部屋の名前
   * @param author 作成者
   * @returns prismaの作成結果
   */
  static async create(roomName: string, author: User) {
    const createResult = await prisma.room.create({
      data: {
        name: roomName,
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

  constructor(
    roomArgs: PrismaTypes.RoomUncheckedCreateInput & {
      joinedUsers: User[];
    }
  ) {
    if (
      !roomArgs.createdAt ||
      !roomArgs.updateAt ||
      !roomArgs.id ||
      !roomArgs.joinedUsers
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
  }
}
