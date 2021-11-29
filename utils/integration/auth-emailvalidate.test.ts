import request from 'supertest';
import { app } from '../../app';
import { User } from '../../model/user';
import { prisma } from '../../prismaClient';

describe('/api/v0/auth/email-confirmation', () => {
  test('get: クエリ無しでgetされたときのテスト', async () => {
    const response = await request(app)
      .get('/api/v0/auth/email-confirmation')
      .expect(400);
  });

  test('post: 正常にメール認証が完了するか', async () => {
    const user = await User.createUserByEmailAndPassword(
      'emailactivatetest@example.com',
      'password',
      ''
    );

    const encodedUserEmail = encodeURIComponent(user.email);

    const token = (
      await prisma.user.findFirst({
        where: {
          email: 'emailactivatetest@example.com',
        },
        include: {
          confirmationToken: true,
        },
      })
    ).confirmationToken.confirmationToken;

    const redirectUrl = `/api/v0/auth/email-confirmation?email=${encodedUserEmail}&token=${token}`;

    const mailUrlRes = await request(app).get(redirectUrl).expect(200);

    const response = await request(app)
      .get(`/api/v0/users/me`)
      .auth(user.validToken.loginToken, { type: 'bearer' })
      .expect(200);
  });

  test('本人確認がされていない状態で他のエンドポイントにアクセスしたときのテスト', async () => {
    // 本人確認しないでユーザーを作成
    const unconfirmedUser = await User.createUserByEmailAndPassword(
      'notactiveusertest@example.com',
      'password',
      ''
    );

    const response = await request(app).get('/api/v0/users/me').expect(401);
  });

  test('トークンを生成してから一日後以降にアクセスされたときに弾くか', async () => {
    const confirmationTokenExpiredTestEmail =
      'confirmationtokenexpiredtest@example.com';
    const confirmationTokenExpiredTestPass = 'password';

    // 本人確認しないでユーザーを作成
    const user = await User.createUserByEmailAndPassword(
      confirmationTokenExpiredTestEmail,
      confirmationTokenExpiredTestPass,
      ''
    );

    const dateAfterTwoDate = new Date(
      new Date().setDate(new Date().getDate() + 2)
    );

    // 2日後に本人確認URLを踏んだ想定
    jest.useFakeTimers('modern');
    jest.setSystemTime(dateAfterTwoDate);

    // 本人確認のためのトークン
    const token = (
      await prisma.user.findFirst({
        where: {
          email: confirmationTokenExpiredTestEmail,
        },
        include: {
          confirmationToken: true,
        },
      })
    ).confirmationToken.confirmationToken;

    expect(token).toBeDefined();

    const encodedEmail = encodeURIComponent(confirmationTokenExpiredTestEmail);

    // 本人確認を行うURL
    const redirectUrl = `/api/v0/auth/email-confirmation?email=${encodedEmail}&token=${token}`;

    // 本人確認処理(2日後にアクセス)
    const response = await request(app).get(redirectUrl).expect(400);
  });
});
