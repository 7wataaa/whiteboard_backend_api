import { prisma } from '../../prismaClient';
import request from 'supertest';
import { app } from '../../app';
import { User } from '../../model/user';
import { iso8601RegExp } from '../jest-setup';

describe('/api/v0/auth/refresh', () => {
  test('正しく新規アクセストークンを返すか', async () => {
    const apiRefreshTestEmail = 'apirefreshtest@example.com';
    const apiRefreshTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      apiRefreshTestEmail,
      apiRefreshTestPass,
      ''
    );

    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .auth(user.validToken.refreshToken, { type: 'bearer' })
      .expect(200);

    expect(response.body).toEqual({
      createdAt: expect.stringMatching(iso8601RegExp),
      loginToken: expect.not.stringContaining(user.validToken.loginToken),
      refreshToken: expect.not.stringContaining(user.validToken.refreshToken),
    });

    expect(
      (
        await prisma.token.findMany({
          where: {
            userId: user.id,
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
