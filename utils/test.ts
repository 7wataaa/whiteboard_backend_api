import crypto from 'crypto';
import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../app';
import { createLoginToken, createRefreshToken } from '../model/createToken';
import { prisma } from '../prismaClient';
import { resetDB } from './resetDB';
dotenv.config();

describe('/app.ts', () => {
  test('ルートパスをgetしたときのテスト', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(404);
    expect(response.text).toBe('Not Found');
  });
});

const existTokenBuffer = crypto.randomBytes(48);

describe('/model/createToken.ts', () => {
  beforeAll(async () => {
    jest.setTimeout(10000);
    await resetDB();
  });

  test('ログイントークンが適切に生成されるか', async () => {
    const now = new Date();

    const { loginToken, loginTokenExpirationAt } = await createLoginToken();

    expect(loginToken).toHaveLength(48);
    expect(loginTokenExpirationAt).toMatch(/Z|[+-](0\d|1[012])(:?[012345]\d)?/);

    const loginTokenExpirationDate = new Date(loginTokenExpirationAt);

    expect(loginTokenExpirationDate.getTime()).toBeGreaterThanOrEqual(
      new Date(now.getTime() + 30 * 60 * 1000).getTime()
    );
  });

  test('ログイントークンがかぶった場合に再生成されるか', async () => {
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
        email: 'logintokentest@example.com',
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
        email: 'refreshtokentest@example.com',
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
  });
});

describe('/api/v0/ping', () => {
  test('getしたときのテスト', async () => {
    const response = await request(app).get('/api/v0/ping');
    expect(response.status).toBe(200);
  });
});
