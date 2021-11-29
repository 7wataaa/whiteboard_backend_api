import * as PrismaTypes from '.prisma/client';
import base64url from 'base64url';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import ExtensibleCustomError from 'extensible-custom-error';
import { prisma } from '../prismaClient';
import { sendgrid } from '../sgMailClient';
import { Room } from './room';

class UserRepository {
  async findUniqueUserById(userId: string) {
    return await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        rooms: true,
        tokens: true,
        confirmationToken: true,
      },
    });
  }

  async findUserByEmail(email: string) {
    return await prisma.user.findFirst({
      where: {
        email: email,
      },
      include: {
        rooms: true,
        tokens: true,
        confirmationToken: true,
      },
    });
  }

  async createUser(data: PrismaTypes.Prisma.UserUncheckedCreateInput) {
    return await prisma.user.create({
      data: data,
      include: {
        rooms: true,
        tokens: true,
        confirmationToken: true,
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
            confirmationToken: true,
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
            confirmationToken: true,
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

  /**
   * ユーザーの本人確認トークンを検索する
   * @param usersEmail 本人確認したいユーザーのメールアドレス
   * @returns {Promise<PrismaTypes.ConfirmationToken>}
   */
  async findConfirmationTokenByEmail(
    usersEmail: string
  ): Promise<PrismaTypes.ConfirmationToken | null> {
    return await prisma.confirmationToken.findFirst({
      where: {
        userEmail: usersEmail,
      },
    });
  }

  /**
   * ユーザーの本人確認トークンを削除し、ユーザーを本人確認済みにする
   * @param usersEmail 本人確認したユーザーのメールアドレス
   * @returns {Promise<void>}
   */
  async changeToConfirmationCompleted(usersEmail: string): Promise<void> {
    const result = await prisma.user.update({
      where: {
        email: usersEmail,
      },
      data: {
        isConfirmed: true,
        confirmationToken: {
          delete: true,
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
  confirmationToken: PrismaTypes.ConfirmationToken | null;
  isConfirmed: boolean;
}

export class User {
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
      confirmationToken: {
        create: {
          confirmationToken: await User.createConfirmationToken(),
        },
      },
    });

    return new User({ ...createdUser });
  }

  static async findUserByEmail(email: string) {
    const user = await User.repository.findUserByEmail(email);

    if (!user) {
      return null;
    }

    return new User({ ...user });
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

  /**
   * 本人確認トークンを生成する
   * @return {string} 生成したトークン
   */
  private static async createConfirmationToken(): Promise<string> {
    const token = base64url(crypto.randomBytes(48));

    return token;
  }

  static async regenerateUsersToken(user: User): Promise<User | null> {
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

  /**
   * ユーザーの本人確認処理を行う。
   * @param {string} email
   * @param {string} token
   * @return {User | null} 本人確認後のユーザー、失敗したらnull
   */
  static async confirmationEmail(
    email: string,
    token: string
  ): Promise<User | null> {
    const userConfirmationToken =
      await User.repository.findConfirmationTokenByEmail(email);

    if (!userConfirmationToken) {
      return null;
    }

    // このメールアドレスとともに保存されているトークンと受け取ったトークンを比較する
    if (token != userConfirmationToken.confirmationToken) {
      return null;
    }

    const after1DayFromTokenCreation = userConfirmationToken.createdAt.setDate(
      userConfirmationToken.createdAt.getDate() + 1
    );

    const isTokenExpired = !(+new Date() <= after1DayFromTokenCreation);

    if (isTokenExpired) {
      return null;
    }

    // ユーザーを確認済みに変更する
    await User.repository.changeToConfirmationCompleted(email);

    return await User.findUserByEmail(email);
  }

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

  // 本人確認に使用するトークン
  confirmationToken: PrismaTypes.ConfirmationToken | null;

  // 本人確認済みかどうか
  isConfirmed: Readonly<boolean>;

  private static repository: Readonly<UserRepository> = new UserRepository();

  constructor(userData: UserInput) {
    this.id = userData.id;
    this.email = userData.email;
    this.username = userData.username;
    this.hashedPassword = userData.hashedPassword;
    this.createdAt = userData.createdAt;
    this.deletedAt = userData.deletedAt;
    this.updatedAt = userData.updatedAt;
    this.role = userData.role;
    this.rooms = userData.rooms;
    this.tokens = userData.tokens;
    this.confirmationToken = userData.confirmationToken;
    this.isConfirmed = userData.isConfirmed;

    const latestToken = userData.tokens.reduce((a, b) =>
      a.createdAt > b.createdAt ? a : b
    );

    this.validToken = User.isLoginTokenEnabled(latestToken.createdAt)
      ? latestToken
      : null;
  }

  /**
   * @param room このユーザーが所属しているか確認したい部屋
   * @returns [room]に所属しているかどうか
   */
  isInRoom(room: Room): boolean {
    return this.rooms.find((r) => r.id == room.id) != undefined;
  }

  /**
   * 本人確認に使用するURLを生成する
   * @returns {string} GETしたら本人確認処理が走るURL
   */
  private generateConfirmationUrl(): string {
    if (!this.confirmationToken) {
      throw new ConfirmationTokenNotFoundError();
    }

    const baseURL = 'http://localhost:3000/api/v0';

    const redirectUrl = new URL(`${baseURL}`);

    redirectUrl.pathname = '/api/v0/auth/email-confirmation';
    redirectUrl.searchParams.set('email', encodeURIComponent(this.email));
    redirectUrl.searchParams.set(
      'token',
      this.confirmationToken.confirmationToken
    );

    return redirectUrl.toString();
  }

  /**
   * ユーザーに本人確認メールを送信する
   * @return {void}
   */
  async sendConfirmationEmail(): Promise<void> {
    const confirmationUrl = this.generateConfirmationUrl();

    await sendgrid.send({
      to: this.email,
      from: 'dev.whiteboardapp@gmail.com',
      subject: 'WhiteBoard 本人確認メール',
      html: `<!DOCTYPE html>
      <html lang="ja">
        <head>
          <meta charset="iso-2022-jp" />
          <title>WhiteBoard本人確認メール</title>
        </head>
        <body>
          <p>下記のボタンをクリックして本人確認をお願いいたします！</p>
          <a href="${confirmationUrl}">確認</a>
        </body>
      </html>
      `,
    });
  }
}

export class ConfirmationTokenNotFoundError extends ExtensibleCustomError {}
