import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../app';
import { User } from '../model/user';
import { prisma } from '../prismaClient';
dotenv.config();

const tokenRegExp = /^[\-\~\+\/\w]{48}$/;

afterEach(async () => {
  jest.restoreAllMocks();

  await prisma.room.deleteMany();
  await prisma.token.deleteMany();
  await prisma.user.deleteMany();
});

/* 処理等のテスト */

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

    // 次回作成時に設定したトークンを返す
    const createLoginTokenSpy = jest.spyOn(User as any, 'createLoginToken');
    createLoginTokenSpy.mockImplementationOnce(
      async () => loginTokenDuplicationTestToken
    );

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

  test('リフレッシュトークンがかぶった場合に再生成されるか', async () => {
    const refreshTokenDuplicationTestEmail =
      'refreshduplicationtest@example.com';
    const refreshTokenDuplicationTestPass = 'password';

    const refreshTokenDuplicationTestToken =
      'zTrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    // 次回作成時に設定したトークンを返す
    const createRefreshTokenSpy = jest.spyOn(User as any, 'createRefreshToken');
    createRefreshTokenSpy.mockImplementationOnce(
      async () => refreshTokenDuplicationTestToken
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

    const regeneratedUser = await (
      await User.findUserById(user.id)
    ).regenerateUsersTokens(beforeRegenerateRefreshToken);

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
    });

    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => existLoginToken);
    randomBytesSpy.mockImplementationOnce(() => existRefreshToken);

    const newUser = await (
      await User.findUserById(user.id)
    ).regenerateUsersTokens(existRefreshToken);

    expect(newUser.validToken.loginToken).toMatch(tokenRegExp);
    expect(newUser.validToken.refreshToken).toMatch(tokenRegExp);

    expect(newUser.validToken.loginToken).not.toBe(existLoginToken);
    expect(newUser.validToken.refreshToken).not.toBe(existRefreshToken);
  });

  // TODO 期限切れ時のテストの実装
});

/* URL叩くテスト */

/* describe('/', () => {
  test('ルートパスをgetしたときのテスト', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(404);
    expect(response.text).toBe('Not Found');
  });
});

describe('/api/v0/ping', () => {
  test('getしたときのテスト', async () => {
    const response = await request(app).get('/api/v0/ping');
    expect(response.status).toBe(200);
  });
});

describe('/api/v0/auth/register', () => {
  test('正しくトークンとリフレッシュトークンが返されるか', async () => {
    const postTestEmail = 'usercreatetest@example.com';
    const postTestPassword = 'password';

    const response = await request(app).post('/api/v0/auth/register').send({
      email: postTestEmail,
      password: postTestPassword,
    });

    expect(response.status).toBe(200);
    expect(response.type).toBe('application/json');

    const tokenRegExp = /^[\-\~\+\/\w]{48}$/;

    expect(response.body['loginToken']).toMatch(tokenRegExp);
    expect(response.body['refreshToken']).toMatch(tokenRegExp);

    // ログイントークンの期限切れ時と今の差が-5000ms+30分以上～30分以下だとOK

    const thirtyMinutes = 1800000;

    const loginTokenTimediff =
      new Date(response.body['loginTokenExpirationAt']).getTime() -
      new Date().getTime();

    expect(loginTokenTimediff).toBeGreaterThanOrEqual(thirtyMinutes - 5000);
    expect(loginTokenTimediff).toBeLessThanOrEqual(thirtyMinutes);

    // リフレッシュトークンの期限切れ時と今の差がミリ秒で-2日+6ヶ月以上～6ヶ月以下だとOK

    const sixMonthAsMillisecond = 15778800000;
    const sixMonthMinusTwoDateAsMillisecond = sixMonthAsMillisecond - 172800000;

    const refreshTokenTimeDiff =
      new Date(response.body['refreshTokenExpirationAt']).getTime() -
      new Date().getTime();

    expect(refreshTokenTimeDiff).toBeLessThanOrEqual(sixMonthAsMillisecond);
    expect(refreshTokenTimeDiff).toBeGreaterThanOrEqual(
      sixMonthMinusTwoDateAsMillisecond
    );

    await deleteUser(prisma, postTestEmail);
  });

  test('不正なメアドだったときにエラーが返されるか', async () => {
    const invalidEmailTestEmail = '';
    const invalidEmailTestPassword = 'password';

    const response = await request(app).post('/api/v0/auth/register').send({
      email: invalidEmailTestEmail,
      password: invalidEmailTestPassword,
    });

    expect(response.status).toBe(400);
  });

  test('不正なパスワードだったときにエラーが返されるか', async () => {
    const invalidPasswordTestEmail = '';
    const invalidPasswordTestPassword = 'password';

    const response = await request(app).post('/api/v0/auth/register').send({
      email: invalidPasswordTestEmail,
      password: invalidPasswordTestPassword,
    });

    expect(response.status).toBe(400);
  });

  test('すでにユーザーが登録されていたときにエラーが返されるか', async () => {
    const aleadyExistsTestEmail = 'aleadyexiststest@example.com';
    const aleadyExistsTestPassword = 'password';

    await prisma.user.create({
      data: {
        username: 'testuser',
        email: aleadyExistsTestEmail,
        hashedPassword: bcrypt.hashSync(aleadyExistsTestPassword, 10),
        loginToken: '',
        loginTokenExpirationAt: new Date(),
        refreshToken: '',
        refreshTokenExpirationAt: new Date(),
      },
    });

    const response = await request(app).post('/api/v0/auth/register').send({
      email: aleadyExistsTestEmail,
      password: aleadyExistsTestPassword,
    });

    expect(response.status).toBe(409);
    expect(response.body['errorMassage']).toBe(
      'このユーザーはすでに登録されています'
    );

    await deleteUser(prisma, aleadyExistsTestEmail);
  });

  test('ユーザーを作成できなかったときにエラーを返されるか', async () => {
    const canNotCreateTestEmail = 'cannotcreatetest@example.com';
    const canNotCreateTestPassword = 'password';

    const prismaUserCreateSpy = jest.spyOn(prisma.user, 'create');

    prismaUserCreateSpy.mockRejectedValue(null);

    const response = await request(app).post('/api/v0/auth/register').send({
      email: canNotCreateTestEmail,
      password: canNotCreateTestPassword,
    });

    expect(response.status).toBe(500);
    expect(response.body['errorMassage']).toBe(
      '何らかの理由でユーザーが作成できなかった'
    );
  });
});

describe('/api/v0/auth/refresh', () => {
  test('正しく新規アクセストークンを返すか', async () => {
    const apiRefreshTestEmail = 'apirefreshtest@example.com';
    const apiRefreshTestPass = 'password';

    const { loginToken } = await createLoginToken();

    const { refreshToken, refreshTokenExpirationAt } =
      await createRefreshToken();

    const user = await prisma.user.create({
      data: {
        username: 'refreshtest',
        email: apiRefreshTestEmail,
        hashedPassword: bcrypt.hashSync(apiRefreshTestPass, 10),
        loginToken: loginToken,
        // ログイントークンの期限は切れている想定
        loginTokenExpirationAt: new Date(1995, 11, 17),
        refreshToken: refreshToken,
        refreshTokenExpirationAt: refreshTokenExpirationAt,
      },
    });

    const createLoginTokenSpy = jest.spyOn(createToken, 'createLoginToken');
    const createRefreshTokenSpy = jest.spyOn(createToken, 'createRefreshToken');

    const mockLoginTokenInfo = {
      // 48文字の文字列
      loginToken: '000000000000000000000000000000000000000000000000',
      loginTokenExpirationAt: new Date(
        new Date().setMinutes(new Date().getMinutes() + 30)
      ).toISOString(),
    };

    const mockRefreshTokenInfo = {
      refreshToken: '111111111111111111111111111111111111111111111111',
      refreshTokenExpirationAt: new Date(
        new Date().setMonth(new Date().getMonth() + 6)
      ).toISOString(),
    };

    createLoginTokenSpy.mockImplementationOnce(async () => mockLoginTokenInfo);
    createRefreshTokenSpy.mockImplementationOnce(
      async () => mockRefreshTokenInfo
    );

    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .auth(refreshToken, { type: 'bearer' });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      ...mockLoginTokenInfo,
      ...mockRefreshTokenInfo,
    });

    expect(
      JSON.parse(
        JSON.stringify(
          await prisma.user.findUnique({
            where: {
              email: apiRefreshTestEmail,
            },
            select: {
              loginToken: true,
              loginTokenExpirationAt: true,
              refreshToken: true,
              refreshTokenExpirationAt: true,
            },
          })
        )
      )
    ).toEqual({
      ...mockLoginTokenInfo,
      ...mockRefreshTokenInfo,
    });
  });

  // TODO 確認できないトークンでpostされたときのテストの実装
  test('確認できないトークンでpostされたときのテスト', async () => {});
});

describe('/api/v0/users/me', () => {
  test('getしたときのテスト', async () => {
    const profileTestEmail = 'profiletest@example.com';
    const profileTestPass = 'password';

    const { loginToken, loginTokenExpirationAt } = await createLoginToken();

    const { refreshToken, refreshTokenExpirationAt } =
      await createRefreshToken();

    const user = await prisma.user.create({
      data: {
        username: 'profiletest',
        email: profileTestEmail,
        hashedPassword: bcrypt.hashSync(profileTestPass, 10),
        loginToken: loginToken,
        loginTokenExpirationAt: loginTokenExpirationAt,
        refreshToken: refreshToken,
        refreshTokenExpirationAt: refreshTokenExpirationAt,
      },
    });

    const response = request(app)
      .get('/api/v0/users/me')
      .auth(loginToken, { type: 'bearer' });

    expect((await response).status).toBe(200);

    expect((await response).body).toEqual({
      id: user.id,
      username: 'profiletest',
      email: profileTestEmail,
    });
  });

  test('トークンなしでgetしたときのテスト', async () => {
    const response = await request(app).get('/api/v0/users/me');

    expect(response.status).toBe(401);
  });
});

describe('/api/v0/rooms', () => {
  test('postしたときのテスト', async () => {
    const roomsPostTestEmail = 'roomsposttest@example.com';
    const roomsPostTestPass = 'password';

    const user = await createUser(roomsPostTestEmail, roomsPostTestPass);
    const userTokens = user.body as createToken.LoginToken &
      createToken.RefreshToken;

    const response = await request(app)
      .post('/api/v0/rooms/create')
      .auth(userTokens.loginToken, { type: 'bearer' })
      .send({
        name: 'test-room',
      })
      .expect(200);

    expect(response.body).toEqual({
      name: expect.stringMatching(/\w{3,10}/),
      roomId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      ),
      createdAt: expect.stringMatching(/Z|[+-](0\d|1[012])(:?[012345]\d)?/),
    });

    expect(
      await prisma.room.findUnique({
        where: {
          id: response.body['roomId'],
        },
      })
    ).not.toBe(null);
  });

  test('room nameのバリデーションのテスト', async () => {
    const roomsPostValidationTestEmail = 'roomspostvalidationtest@example.com';
    const roomsPostValidationTestPass = 'password';

    const user = await createUser(
      roomsPostValidationTestEmail,
      roomsPostValidationTestPass
    );
    const userTokens = user.body as createToken.LoginToken &
      createToken.RefreshToken;

    const response = await request(app)
      .post('/api/v0/rooms/create')
      .auth(userTokens.loginToken, { type: 'bearer' })
      .send({
        name: '',
      })
      .expect(400);
  });

  test('作成したユーザーがその部屋に入っているか', async () => {
    const roomPostUserJoinedTestEmail = 'roompostuserjoinedtest@example.com';
    const roomPostUserJoinedTestPass = 'password';

    const user = await createUser(
      roomPostUserJoinedTestEmail,
      roomPostUserJoinedTestPass
    );

    const userTokens = user.body as createToken.LoginToken &
      createToken.RefreshToken;

    const response = await request(app)
      .post('/api/v0/rooms/create')
      .auth(userTokens.loginToken, { type: 'bearer' })
      .send({ name: 'roomuserjoinedtestroom' })
      .expect(200);

    const room = await prisma.room.findUnique({
      where: {
        id: response.body['roomId'],
      },
      include: {
        joinedUsers: true,
      },
    });

    expect(room.joinedUsers).toEqual([
      await prisma.user.findUnique({
        where: {
          email: roomPostUserJoinedTestEmail,
        },
      }),
    ]);
  });
 */
/* describe('/api/v0/rooms/:id/posts', () => {
  test('');
});

describe('/api/v0/rooms/:id/posts/:id', () => {
  test('');
});
 */
