import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../../model/user';
import { prisma } from '../../prismaClient';
import { tokenRegExp } from '../jest-setup';

describe('/model/user.ts', () => {
  test('email, passでトークンが適切に生成されるか', async () => {
    const createTestEmail = 'createtest@example.com';
    const createTestPassword = 'password';

    const user = await User.createUserByEmailAndPassword(
      createTestEmail,
      createTestPassword,
      ''
    );

    expect(user.validToken.loginToken).toMatch(tokenRegExp);
    expect(user.validToken.refreshToken).toMatch(tokenRegExp);
  });

  test('ログイントークンがかぶった場合に再生成されるか', async () => {
    const loginTokenDuplicationTestEmail =
      'logintokenduplicationtest@example.com';
    const loginTokenDuplicationTestPass = 'password';

    const loginTokenDuplicationTestToken =
      'zTrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    // 次回と次々回に同じ文字列を出力する
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => loginTokenDuplicationTestToken);
    randomBytesSpy.mockImplementationOnce(() => loginTokenDuplicationTestToken);

    const existUser = await User.createUserByEmailAndPassword(
      'logintokenduplicationtestexistuser@example.com',
      'password',
      'kaburu-user'
    );

    const testUser = await User.createUserByEmailAndPassword(
      loginTokenDuplicationTestEmail,
      loginTokenDuplicationTestPass,
      'testuser'
    );

    expect(testUser.validToken.loginToken).toMatch(tokenRegExp);
    expect(testUser.validToken.loginToken).not.toBe(
      loginTokenDuplicationTestToken
    );
  });

  test('ログイントークンが無効なトークンと重複したときに同じトークンになるか', async () => {
    const email = 'logintokenduplicationbutusefultest1@example.com';

    const oldDuplicationToken =
      'OLDGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    const oldUser = await prisma.user.create({
      data: {
        email: email,
        hashedPassword: '',
        username: '',
        tokens: {
          create: {
            loginToken: oldDuplicationToken,
            refreshToken: '',
            createdAt: new Date(1980, 12, 31),
          },
        },
      },
    });

    // 次回に同じ文字列を出力する
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => oldDuplicationToken);

    const user = await User.createUserByEmailAndPassword(
      'logintokenduplicationbutusefultest2@example.com',
      'password',
      ''
    );

    expect(user.validToken.loginToken).toBe(oldDuplicationToken);
  });

  test('リフレッシュトークンがかぶった場合に再生成されるか', async () => {
    const refreshTokenDuplicationTestEmail =
      'refreshduplicationtest@example.com';
    const refreshTokenDuplicationTestPass = 'password';

    const refreshTokenDuplicationTestToken =
      'zTrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    // 次回と次々回に同じ文字列を出力する
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(
      () => refreshTokenDuplicationTestToken
    );
    randomBytesSpy.mockImplementationOnce(
      () => refreshTokenDuplicationTestToken
    );

    const existUser = await User.createUserByEmailAndPassword(
      'logintokenduplicationtestexistuser@example.com',
      'password',
      'kaburu-user'
    );

    const testUser = await User.createUserByEmailAndPassword(
      refreshTokenDuplicationTestEmail,
      refreshTokenDuplicationTestPass,
      'testuser'
    );

    expect(testUser.validToken.refreshToken).toMatch(tokenRegExp);
    expect(testUser.validToken.refreshToken).not.toBe(
      refreshTokenDuplicationTestToken
    );
  });

  test('リフレッシュトークンが無効なトークンと重複したときに同じトークンになるか', async () => {
    const email = 'refreshtokenduplicationbutusefultest1@example.com';

    const oldDuplicationToken =
      'OLDREFRESHMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    const oldUser = await prisma.user.create({
      data: {
        email: email,
        hashedPassword: '',
        username: '',
        tokens: {
          create: {
            loginToken: '',
            refreshToken: oldDuplicationToken,
            createdAt: new Date(1980, 12, 31),
          },
        },
      },
    });

    // リフレッシュトークンはログイントークンのあとに発行されるので、2回目に同じ文字列が出力されればいい
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => oldDuplicationToken);
    randomBytesSpy.mockImplementationOnce(() => oldDuplicationToken);

    const user = await User.createUserByEmailAndPassword(
      'logintokenduplicationbutusefultest2@example.com',
      'password',
      ''
    );

    expect(user.validToken.refreshToken).toBe(oldDuplicationToken);
  });

  test('トークンから正しくユーザーデータを取得できるか', async () => {
    const findByTokenTestEmail = 'findbytokentest@example.com';
    const findByTokenTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      findByTokenTestEmail,
      findByTokenTestPass,
      ''
    );

    const findResult = await User.findUserByLoginToken(
      user.validToken.loginToken
    );

    expect(findResult).toStrictEqual(user);
  });

  test('ログイントークンに合致するユーザーがいなかったときのテスト', async () => {
    const loginTokenNotMatchTestToken =
      'zTrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKypa';

    const findResult = await User.findUserByLoginToken(
      loginTokenNotMatchTestToken
    );

    expect(findResult).toBe(null);
  });

  test('リフレッシュ時に正しくトークンが置き換わるか', async () => {
    const regenerateTestEmail = 'regeneratetest@example.com';
    const regenerateTestPass = 'password';

    const beforeRegenerateLoginToken =
      'BLrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhoyps';
    const beforeRegenerateRefreshToken =
      'BRrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhppKyps';

    const user = await prisma.user.create({
      data: {
        email: regenerateTestEmail,
        hashedPassword: bcrypt.hashSync(regenerateTestPass, 10),
        username: '',
        tokens: {
          create: {
            loginToken: beforeRegenerateLoginToken,
            refreshToken: beforeRegenerateRefreshToken,
          },
        },
      },
      include: {
        rooms: true,
        tokens: true,
      },
    });

    const regeneratedUser = await User.regenerateUsersToken(
      user.tokens[0].refreshToken
    );

    expect(regeneratedUser.id).toEqual(user.id);

    expect(regeneratedUser.validToken.loginToken).toMatch(tokenRegExp);
    expect(regeneratedUser.validToken.refreshToken).toMatch(tokenRegExp);

    expect(regeneratedUser.validToken.loginToken).not.toBe(
      beforeRegenerateLoginToken
    );

    expect(regeneratedUser.validToken.refreshToken).not.toBe(
      beforeRegenerateRefreshToken
    );
  });

  test('リフレッシュ後のトークンがリフレッシュ前と同じものになってしまわないかのテスト', async () => {
    const refreshTokenSameAsBeforeTestEmail =
      'refreshtokensameasbeforetest@example.com';

    const existRefreshToken =
      'EXISTREFRESH5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';
    const existLoginToken = 'EXISTLOGINMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    const user = await prisma.user.create({
      data: {
        email: refreshTokenSameAsBeforeTestEmail,
        hashedPassword: '',
        username: '',
        tokens: {
          create: {
            loginToken: existLoginToken,
            refreshToken: existRefreshToken,
          },
        },
      },
      include: {
        tokens: true,
      },
    });

    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => existLoginToken);
    randomBytesSpy.mockImplementationOnce(() => existRefreshToken);

    const newUser = await User.regenerateUsersToken(
      user.tokens[0].refreshToken
    );

    expect(newUser.validToken.loginToken).toMatch(tokenRegExp);
    expect(newUser.validToken.refreshToken).toMatch(tokenRegExp);

    expect(newUser.validToken.loginToken).not.toBe(existLoginToken);
    expect(newUser.validToken.refreshToken).not.toBe(existRefreshToken);
  });

  // TODO 期限切れ時のテストの実装
});
