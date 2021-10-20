import * as PrismaTypes from '.prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../prismaClient';

class UserRepository {
  async findUniqueUserById(userId: string) {
    return await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        rooms: true,
        tokens: true,
      },
    });
  }

  async findFirstUserByEmail(email: string) {
    return await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
  }

  async createUser(data: PrismaTypes.Prisma.UserUncheckedCreateInput) {
    return await prisma.user.create({
      data: data,
      include: {
        rooms: true,
        tokens: true,
      },
    });
  }

  async findLatestLoginToken(loginToken: string) {
    return await prisma.token.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        loginToken: loginToken,
      },
      include: {
        user: {
          include: {
            rooms: true,
            tokens: true,
          },
        },
      },
    });
  }

  async findLatestRefreshToken(refreshToken: string) {
    return await prisma.token.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        refreshToken: refreshToken,
      },
      include: {
        user: {
          include: {
            rooms: true,
            tokens: true,
          },
        },
      },
    });
  }

  async createNewUserToken(
    userId: string,
    newLoginToken: string,
    newRefreshToken: string
  ) {
    return await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        tokens: {
          createMany: {
            data: {
              loginToken: newLoginToken,
              refreshToken: newRefreshToken,
            },
          },
        },
      },
    });
  }
}

interface UserInput {
  id: string;
  email: string;
  username: string;
  hashedPassword: string;
  createdAt: Date;
  deletedAt: Date | null;
  updatedAt: Date;
  role: PrismaTypes.Role;
  rooms: PrismaTypes.Room[];
  tokens: PrismaTypes.Token[];
}

export class User {
  // ユーザーのID、形式はUUID。
  id: Readonly<string>;

  // ユニークなメールアドレス
  email: Readonly<string>;

  // ユーザーネーム、空文字列の可能性あり
  username: Readonly<string>;

  // セキュリティのためハッシュ化したパスワード
  hashedPassword: Readonly<string>;

  // 登録日時
  createdAt: Readonly<Date>;

  // 削除日時、これに値が入ってると論理削除判定
  deletedAt: Readonly<Date | null>;

  // 更新日時
  updatedAt: Readonly<Date>;

  // ユーザーの種類
  role: Readonly<PrismaTypes.Role>;

  // ユーザーが入室している部屋一覧
  rooms: Readonly<PrismaTypes.Room[]>;

  // ユーザーに紐付けられているトークンs、有効なトークンがない場合もある
  tokens: Readonly<PrismaTypes.Token[]>;

  // 現在有効なトークン、ない場合もある
  validToken: Readonly<PrismaTypes.Token | null>;

  private static repository: Readonly<UserRepository> = new UserRepository();

  constructor(a: UserInput) {
    this.id = a.id;
    this.email = a.email;
    this.username = a.username;
    this.hashedPassword = a.hashedPassword;
    this.createdAt = a.createdAt;
    this.deletedAt = a.deletedAt;
    this.updatedAt = a.updatedAt;
    this.role = a.role;
    this.rooms = a.rooms;
    this.tokens = a.tokens;

    const latestToken = a.tokens.reduce((a, b) =>
      a.createdAt > b.createdAt ? a : b
    );

    this.validToken = User.isLoginTokenEnabled(latestToken.createdAt)
      ? latestToken
      : null;
  }

  static async findUserById(userId: string) {
    const user = await User.repository.findUniqueUserById(userId);

    if (!user) {
      return null;
    }

    return new User(user);
  }

  static async createUserByEmailAndPassword(
    email: string,
    password: string,
    username: string
  ) {
    const loginToken = await User.createLoginToken();
    const refreshToken = await User.createRefreshToken();

    const createdUser = await User.repository.createUser({
      email: email,
      hashedPassword: bcrypt.hashSync(password, 10),
      username: username,
      tokens: { create: { loginToken, refreshToken } },
    });

    return new User({ ...createdUser });
  }

  static findFirstUserByEmail(email: string) {
    return User.repository.findFirstUserByEmail(email);
  }

  private static isLoginTokenEnabled(createdDate: Date): boolean {
    const after30MinutesDate = (date: Date) =>
      new Date(date.setMinutes(date.getMinutes() + 30));

    return new Date() < after30MinutesDate(createdDate);
  }

  static async findUserByLoginToken(loginToken: string): Promise<User | null> {
    const loginTokenData = await User.repository.findLatestLoginToken(
      loginToken
    );

    if (!loginTokenData) {
      return null;
    }

    if (!User.isLoginTokenEnabled(loginTokenData.createdAt)) {
      return null;
    }

    return new User({ ...loginTokenData.user });
  }

  private static isRefreshTokenEnabled(refreshToken: Date): boolean {
    const after6MonthsDate = (date: Date) =>
      new Date(date.setMonth(date.getMonth() + 6));

    return new Date() < after6MonthsDate(refreshToken);
  }

  static async findUserByRefreshToken(
    refreshToken: string
  ): Promise<User | null> {
    const refreshTokenData = await User.repository.findLatestRefreshToken(
      refreshToken
    );

    if (!refreshTokenData) {
      return null;
    }

    if (!User.isRefreshTokenEnabled(refreshTokenData.createdAt)) {
      return null;
    }

    return new User({ ...refreshTokenData.user });
  }

  private static async createLoginToken(): Promise<string> {
    const isLoginTokenAlreadyExists = async (str: string): Promise<boolean> => {
      const queryResult = await prisma.token.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          loginToken: str,
        },
      });

      // 同じトークンが存在している && そのトークンが有効
      return (
        queryResult != null && User.isLoginTokenEnabled(queryResult.createdAt)
      );
    };

    let loginToken = crypto.randomBytes(48).toString('base64').substring(0, 48);

    // 有効なトークンと同じ文字列だったら再生成する
    while (await isLoginTokenAlreadyExists(loginToken)) {
      loginToken = crypto.randomBytes(48).toString('base64').substring(0, 48);
    }

    return loginToken;
  }

  private static async createRefreshToken(): Promise<string> {
    const isRefreshTokenAlreadyExists = async (
      str: string
    ): Promise<boolean> => {
      const queryResult = await prisma.token.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          refreshToken: str,
        },
      });

      // 同じトークンが存在している && そのトークンが有効
      return (
        queryResult != null && User.isRefreshTokenEnabled(queryResult.createdAt)
      );
    };

    let refreshToken = crypto
      .randomBytes(48)
      .toString('base64')
      .substring(0, 48);

    // 有効なトークンと同じ文字列だったら再生成する
    while (await isRefreshTokenAlreadyExists(refreshToken)) {
      refreshToken = crypto.randomBytes(48).toString('base64').substring(0, 48);
    }

    return refreshToken;
  }

  static async regenerateUsersToken(
    refreshToken: string
  ): Promise<User | null> {
    const user = await User.findUserByRefreshToken(refreshToken);

    if (!user) {
      return null;
    }

    let newLoginToken = await User.createLoginToken();

    let newRefreshToken = await User.createRefreshToken();

    const updatedToken = await User.repository.createNewUserToken(
      user.id,
      newLoginToken,
      newRefreshToken
    );

    const updatedUser = await User.findUserById(updatedToken.id);

    return updatedUser;
  }
}
