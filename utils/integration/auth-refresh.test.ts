import request from 'supertest';
import { app } from '../../app';
import { User } from '../../model/user';
import { prisma } from '../../prismaClient';
import { iso8601RegExp, registerRequest } from '../jest-setup';

describe('/api/v0/auth/refresh', () => {
  test('正しく新規アクセストークンを返すか', async () => {
    const apiRefreshTestEmail = 'apirefreshtest@example.com';
    const apiRefreshTestPass = 'password';

    const user = await registerRequest(apiRefreshTestEmail, apiRefreshTestPass);

    const loginToken = user.body['loginToken'];
    const refreshToken = user.body['refreshToken'];

    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .auth(refreshToken, { type: 'bearer' })
      .expect(200);

    expect(response.body).toEqual({
      createdAt: expect.stringMatching(iso8601RegExp),
      loginToken: expect.not.stringContaining(loginToken),
      refreshToken: expect.not.stringContaining(refreshToken),
    });

    expect(
      (
        await prisma.token.findMany({
          where: {
            userId: (await User.findUserByEmail(apiRefreshTestEmail)).id,
          },
        })
      ).length
    ).toBe(2);
  });

  test('文字数が正しくないトークンでpostされたときのテスト', async () => {
    const unkownToken = 'qwertqwertqwertqwertqwertqwertqwertqwertqwert';

    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .auth(unkownToken, { type: 'bearer' })
      .expect(401);
  });

  test('トークン無しでpostされたときのテスト', async () => {
    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .expect(401);
  });
});
