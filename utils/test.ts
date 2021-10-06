import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../app';
import { createLoginToken, createRefreshToken } from '../model/createToken';
import { prisma } from '../prismaClient';
import { deleteUser } from './deleteUser';
import { login } from '../model/login';
dotenv.config();

/* 処理等のテスト */

describe('/app.ts', () => {
  test('ルートパスをgetしたときのテスト', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(404);
    expect(response.text).toBe('Not Found');
  });
});

const existTokenBuffer = crypto.randomBytes(48);

describe('/model/createToken.ts', () => {
  test('ログイントークンが適切に生成されるか', async () => {
    const now = new Date();

    const { loginToken, loginTokenExpirationAt } = await createLoginToken();

    expect(loginToken).toHaveLength(48);
    expect(loginTokenExpirationAt).toMatch(/Z|[+-](0\d|1[012])(:?[012345]\d)?/);

    const loginTokenExpirationDate = new Date(loginTokenExpirationAt);

    // 前と今の差が-5000mx+30分以上～30分以下だとOK

    const thirtyMinutes = 1800000;

    const diff = loginTokenExpirationDate.getTime() - new Date().getTime();

    expect(diff).toBeGreaterThanOrEqual(thirtyMinutes - 5000);
    expect(diff).toBeLessThanOrEqual(thirtyMinutes);
  });

  test('ログイントークンがかぶった場合に再生成されるか', async () => {
    const loginTokenTestEmail = 'logintokentest@example.com';

    const CryptoRandomBytesSpy = jest.spyOn(crypto, 'randomBytes');

    CryptoRandomBytesSpy.mockImplementationOnce((num: number) => {
      return existTokenBuffer;
    });

    const existLoginToken = existTokenBuffer
      .toString('base64')
      .substring(0, 48);

    await prisma.user.create({
      data: {
        username: 'testuser',
        email: loginTokenTestEmail,
        hashedPassword: '',
        loginToken: existLoginToken,
        loginTokenExpirationAt: new Date(new Date().getTime() + 30 * 60 * 1000),
        refreshToken: '',
        refreshTokenExpirationAt: new Date(
          new Date().getTime() + 30 * 24 * 60 * 60 * 1000
        ),
      },
    });

    const { createLoginToken } = await import('../model/createToken');

    const { loginToken } = await createLoginToken();

    expect(loginToken).not.toBe(existLoginToken);

    CryptoRandomBytesSpy.mockRestore();

    await deleteUser(prisma, loginTokenTestEmail);
  });

  test('リフレッシュトークンが適切に生成されるか', async () => {
    const { refreshToken, refreshTokenExpirationAt } =
      await createRefreshToken();

    expect(refreshToken).toHaveLength(48);
    expect(refreshTokenExpirationAt).toMatch(
      /Z|[+-](0\d|1[012])(:?[012345]\d)?/
    );

    const refreshTokenExpirationDate = new Date(refreshTokenExpirationAt);

    // 前と後の差がミリ秒で-2日+6ヶ月以上～6ヶ月以下だとOK

    const sixMonthAsMillisecond = 15778800000;
    const sixMonthMinusTwoDateAsMillisecond = sixMonthAsMillisecond - 172800000;

    const dateDifference =
      refreshTokenExpirationDate.getTime() - new Date().getTime();

    expect(dateDifference).toBeLessThanOrEqual(sixMonthAsMillisecond);
    expect(dateDifference).toBeGreaterThanOrEqual(
      sixMonthMinusTwoDateAsMillisecond
    );
  });

  test('リフレッシュトークンがかぶった場合に再生成されるか', async () => {
    const refreshTokenTestEmail = 'refreshtokentest@example.com';

    const CryptoRandomBytesSpy = jest.spyOn(crypto, 'randomBytes');

    CryptoRandomBytesSpy.mockImplementationOnce((num: number) => {
      return existTokenBuffer;
    });

    const existRefreshToken = existTokenBuffer
      .toString('base64')
      .substring(0, 48);

    await prisma.user.create({
      data: {
        username: 'testuser',
        email: refreshTokenTestEmail,
        hashedPassword: '',
        loginToken: '',
        loginTokenExpirationAt: new Date(new Date().getTime() + 30 * 60 * 1000),
        refreshToken: existRefreshToken,
        refreshTokenExpirationAt: new Date(
          new Date().getTime() + 30 * 24 * 60 * 60 * 1000
        ),
      },
    });

    const { createRefreshToken } = await import('../model/createToken');

    const { refreshToken } = await createRefreshToken();

    expect(refreshToken).not.toBe(existRefreshToken);

    CryptoRandomBytesSpy.mockRestore();

    await deleteUser(prisma, refreshTokenTestEmail);
  });
});

describe('/model/login.ts', () => {
  test('正しくユーザーデータを取得できるか', async () => {
    const loginTestEmail = 'logintestemail@example.com';
    const loginTestPassword = 'password';
    const { loginToken, loginTokenExpirationAt } = await createLoginToken();

    const { refreshToken, refreshTokenExpirationAt } =
      await createRefreshToken();

    await prisma.user.create({
      data: {
        username: 'logintest',
        email: loginTestEmail,
        hashedPassword: bcrypt.hashSync(loginTestPassword, 10),
        loginToken: loginToken,
        loginTokenExpirationAt: loginTokenExpirationAt,
        refreshToken: refreshToken,
        refreshTokenExpirationAt: refreshTokenExpirationAt,
      },
    });

    const loginTestUser = await login(loginToken);

    expect(loginTestUser.username).toBe('logintest');
    expect(loginTestUser.email).toBe(loginTestEmail);
    expect(
      bcrypt.compareSync(loginTestPassword, loginTestUser.hashedPassword)
    ).toBeTruthy();

    await deleteUser(prisma, loginTestEmail);
  });

  test('ログイントークンに合致するユーザーがいなかったときのテスト', async () => {
    const loginFailureToken =
      'loginFailureToken1234512345123451234512345123451';

    const loginTestUser = await login(loginFailureToken);

    expect(loginTestUser).toBe(null);
  });
});

/* URL叩くテスト */

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
